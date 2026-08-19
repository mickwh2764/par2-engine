import type { Express, Request, Response } from "express";
import { storage } from "../storage";
import { logger } from "../logger";
import { detectOrganism, CANDIDATES, CLOCKS, generateAuditFilename, sanitizePathParam, verifyDownloadPassword, wrapText, generateExplosiveDynamicsDatasetSections, loadExplosiveDynamicsData, ENGINE_VERSION, ENSEMBL_TO_SYMBOL, applyFDRCorrectionToRun, getAllPairs, parseDatasetBuffer, ARABIDOPSIS_TARGETS, ARABIDOPSIS_CLOCKS, getDefaultPairs, DEFAULT_PAIRS, getClocksForDataset, getTargetsForDataset, ENSEMBL_TO_GENE_SYMBOL, getDisplayName, checkGeneAvailability, generateMockData } from "./shared";
import { runPAR2Analysis, applyWithinPairBonferroni, type PAR2Result, type GeneData, type PAR2Config, benjaminiHochberg, checkClockRhythmicity, type ClockRhythmicityCheck, resolveGeneName, runQuickNullSurvey, runValidationSuite, assessDataQuality, runGenomeWideScreen } from "../par2-engine";
import { type ParsedDataset } from "./shared";
import { generateIntegrityHash, formatHashForDisplay } from "../integrity-hash";
import { runLiteratureValidation } from "../literature-validation";
import { runPhaseVulnerabilityAnalysis } from "../phase-vulnerability";
import { generateReproducibilityPackage, generateMinimalDataCSV } from "../reproducibility-package";
import { parse } from "csv-parse/sync";
import fs from "fs";
import path from "path";
import archiver from "archiver";

export function registerDownloadRoutes(app: Express, upload: any): void {
  app.get("/api/download/stability-audit-report", async (req, res) => {
    try {
      const format = req.query.format as string || 'csv';
      const allRuns = await storage.getAllAnalysisRuns();
      const completedRuns = allRuns.filter(run => run.status === 'completed');
      
      interface AuditRow {
        timestamp: string;
        dataset: string;
        organism: string;
        clockGene: string;
        targetGene: string;
        pValue: number;
        significant: boolean;
        eigenvalueModulus: number;
        inStabilityBand: boolean;
        description: string;
      }
      
      const auditRows: AuditRow[] = [];
      
      for (const run of completedRuns) {
        const hypotheses = await storage.getHypothesesByRunId(run.id);
        const organism = detectOrganism(run.datasetName);
        
        for (const hyp of hypotheses) {
          if (hyp.pValue === null || hyp.pValue === 1) continue;
          
          let eigenvalue = 0.5;
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
          
          auditRows.push({
            timestamp: run.createdAt?.toISOString() || new Date().toISOString(),
            dataset: run.datasetName,
            organism,
            clockGene: hyp.clockGene,
            targetGene: hyp.targetGene,
            pValue: hyp.pValue,
            significant: hyp.significant || false,
            eigenvalueModulus: Math.round(eigenvalue * 1000) / 1000,
            inStabilityBand: eigenvalue >= 0.40 && eigenvalue <= 0.80,  // Updated: real data range
            description: hyp.description || ''
          });
        }
      }
      
      if (format === 'json') {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="PAR2_Stability_Audit_${new Date().toISOString().split('T')[0]}.json"`);
        return res.json({
          generatedAt: new Date().toISOString(),
          methodology: "PAR(2) 48-hour stability modulus audit across all analyzed datasets",
          stabilityBandDefinition: "Real data (Jan 2026 audit): Target genes mean=0.537, Clock genes mean=0.689",
          totalRecords: auditRows.length,
          records: auditRows
        });
      }
      
      // CSV format
      const csvHeader = 'Timestamp,Dataset,Organism,Clock_Gene,Target_Gene,P_Value,Significant,Eigenvalue_Modulus,In_Stability_Band,Description';
      const csvRows = auditRows.map(r => 
        `"${r.timestamp}","${r.dataset}","${r.organism}","${r.clockGene}","${r.targetGene}",${r.pValue},${r.significant},${r.eigenvalueModulus},${r.inStabilityBand},"${r.description.replace(/"/g, '""')}"`
      );
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="PAR2_Stability_Audit_${new Date().toISOString().split('T')[0]}.csv"`);
      res.send([csvHeader, ...csvRows].join('\n'));
      
    } catch (error) {
      console.error("Error generating stability audit report:", error);
      res.status(500).json({ error: "Failed to generate stability audit report" });
    }
  });

  // π_G₀ ↔ |λ| Mapping - Cell-cycle latency to eigenvalue relationship
  app.get("/api/analyses/pi-g0-mapping", async (req, res) => {
    try {
      const allRuns = await storage.getAllAnalysisRuns();
      const completedRuns = allRuns.filter(run => run.status === 'completed');
      
      // Theoretical π_G₀ ↔ |λ| relationship:
      // π_G₀ = probability of cells in G0 latency
      // |λ| = eigenvalue modulus (temporal persistence)
      // 
      // Higher |λ| → slower decay → cells stay in state longer
      // Mathematical relationship: π_G₀ ≈ |λ|² / (1 + |λ|²)
      // Or equivalently: |λ| ≈ √(π_G₀ / (1 - π_G₀))
      
      interface DatasetMapping {
        dataset: string;
        organism: string;
        meanEigenvalue: number;
        predictedPiG0: number;
        eigenvalueDistribution: {
          low: number;  // < 0.40 (below target gene range)
          stable: number;  // 0.40-0.80 (target-clock gene range)
          high: number;  // > 0.80 (above clock gene range)
        };
        condition: 'normal' | 'mutant' | 'unknown';
      }
      
      const datasetMappings: DatasetMapping[] = [];
      
      for (const run of completedRuns) {
        const hypotheses = await storage.getHypothesesByRunId(run.id);
        const eigenvalues: number[] = [];
        
        let debugCount = 0;
        let hasCoefCount = 0;
        for (const hyp of hypotheses) {
          if (hyp.pValue === null || hyp.pValue === 1) continue;
          
          let eigenvalue = 0.5;
          if (hyp.confidenceIntervals) {
            try {
              // Drizzle returns jsonb as object, not string
              const ci = typeof hyp.confidenceIntervals === 'string' 
                ? JSON.parse(hyp.confidenceIntervals) 
                : hyp.confidenceIntervals;
              const phi1 = ci.R_n_1?.coefficient ?? 0;
              const phi2 = ci.R_n_2?.coefficient ?? 0;
              
              if (phi1 !== 0 || phi2 !== 0) {
                hasCoefCount++;
                const discriminant = phi1 * phi1 + 4 * phi2;
                if (discriminant >= 0) {
                  const lambda1 = (phi1 + Math.sqrt(discriminant)) / 2;
                  const lambda2 = (phi1 - Math.sqrt(discriminant)) / 2;
                  eigenvalue = Math.max(Math.abs(lambda1), Math.abs(lambda2));
                } else {
                  eigenvalue = Math.sqrt(Math.abs(phi2));
                }
                if (debugCount < 3) {
                  console.log(`[pi-g0] phi1=${phi1.toFixed(3)}, phi2=${phi2.toFixed(3)}, |λ|=${eigenvalue.toFixed(3)}`);
                  debugCount++;
                }
                if (eigenvalue > 2 || isNaN(eigenvalue)) eigenvalue = 0.5;
              }
            } catch (e) { 
              console.log(`[pi-g0] Error: ${e}`);
            }
          }
          eigenvalues.push(eigenvalue);
        }
        
        if (eigenvalues.length === 0) continue;
        
        const meanEigenvalue = eigenvalues.reduce((a, b) => a + b, 0) / eigenvalues.length;
        // Log for first dataset with actual coefficients
        if (hasCoefCount > 0 && debugCount === 0) {
          console.log(`[pi-g0-debug] ${run.datasetName}: ${eigenvalues.length} eigenvalues, ${hasCoefCount} with coefs, mean=${meanEigenvalue.toFixed(3)}`);
        }
        
        // Calculate predicted π_G₀ from eigenvalue
        // Using: π_G₀ ≈ |λ|² / (1 + |λ|²)
        const predictedPiG0 = Math.pow(meanEigenvalue, 2) / (1 + Math.pow(meanEigenvalue, 2));
        
        // Determine condition from dataset name
        let condition: 'normal' | 'mutant' | 'unknown' = 'unknown';
        if (run.datasetName.includes('WT') || run.datasetName.includes('GSE54650')) {
          condition = 'normal';
        } else if (run.datasetName.includes('Mut') || run.datasetName.includes('APC-Mut')) {
          condition = 'mutant';
        }
        
        datasetMappings.push({
          dataset: run.datasetName,
          organism: detectOrganism(run.datasetName),
          meanEigenvalue: Math.round(meanEigenvalue * 1000) / 1000,
          predictedPiG0: Math.round(predictedPiG0 * 1000) / 1000,
          eigenvalueDistribution: {
            low: eigenvalues.filter(e => e < 0.40).length,  // Below target gene range
            stable: eigenvalues.filter(e => e >= 0.40 && e <= 0.80).length,  // Target-clock gene range
            high: eigenvalues.filter(e => e > 0.80).length  // Above clock gene range
          },
          condition
        });
      }
      
      // Group by condition for comparison
      const normalDatasets = datasetMappings.filter(d => d.condition === 'normal');
      const mutantDatasets = datasetMappings.filter(d => d.condition === 'mutant');
      
      const normalMeanLambda = normalDatasets.length > 0
        ? normalDatasets.reduce((sum, d) => sum + d.meanEigenvalue, 0) / normalDatasets.length
        : 0;
      const mutantMeanLambda = mutantDatasets.length > 0
        ? mutantDatasets.reduce((sum, d) => sum + d.meanEigenvalue, 0) / mutantDatasets.length
        : 0;
      
      const deltaLambda = mutantMeanLambda - normalMeanLambda;
      
      res.json({
        summary: {
          totalDatasets: datasetMappings.length,
          normalDatasets: normalDatasets.length,
          mutantDatasets: mutantDatasets.length,
          normalMeanEigenvalue: Math.round(normalMeanLambda * 1000) / 1000,
          mutantMeanEigenvalue: Math.round(mutantMeanLambda * 1000) / 1000,
          deltaLambda: Math.round(deltaLambda * 1000) / 1000,
          normalPredictedPiG0: Math.round((Math.pow(normalMeanLambda, 2) / (1 + Math.pow(normalMeanLambda, 2))) * 1000) / 1000,
          mutantPredictedPiG0: Math.round((Math.pow(mutantMeanLambda, 2) / (1 + Math.pow(mutantMeanLambda, 2))) * 1000) / 1000,
          pathogenicDriftDetected: deltaLambda > 0.1
        },
        datasetMappings,
        methodology: {
          description: "Maps eigenvalue modulus (|λ|) to predicted cell-cycle G₀ latency probability (π_G₀)",
          formula: "π_G₀ = |λ|² / (1 + |λ|²)",
          interpretation: "Higher |λ| predicts higher π_G₀ (cells stay in G₀ longer). Mutant tissues showing Δλ > 0.1 indicate pathogenic drift.",
          biologicalBasis: "The AR(2) eigenvalue modulus reflects intrinsic temporal persistence of gene expression states, which correlates with cell-cycle checkpoint duration."
        },
        conditionComparison: {
          normal: {
            meanEigenvalue: Math.round(normalMeanLambda * 1000) / 1000,
            predictedPiG0: Math.round((Math.pow(normalMeanLambda, 2) / (1 + Math.pow(normalMeanLambda, 2))) * 1000) / 1000,
            interpretation: "Normal tissue: balanced circadian-cell cycle coupling"
          },
          mutant: {
            meanEigenvalue: Math.round(mutantMeanLambda * 1000) / 1000,
            predictedPiG0: Math.round((Math.pow(mutantMeanLambda, 2) / (1 + Math.pow(mutantMeanLambda, 2))) * 1000) / 1000,
            interpretation: deltaLambda > 0.1 
              ? "Mutant tissue: elevated persistence suggests cells accumulate in G₀ (pathogenic attractor)"
              : "Mutant tissue: similar dynamics to normal (no pathogenic drift detected)"
          }
        }
      });
      
    } catch (error) {
      console.error("Error computing π_G₀ mapping:", error);
      res.status(500).json({ error: "Failed to compute π_G₀ mapping" });
    }
  });

  // Cross-Context Comparison - MUST be before :id route
  function fitAR2Eigenvalue(values: number[]): number {
    const n = values.length;
    if (n < 5) return 0;
    const y = values.slice(2);
    const x1 = values.slice(1, n - 1);
    const x2 = values.slice(0, n - 2);
    const m = y.length;
    let sx1x1 = 0, sx1x2 = 0, sx2x2 = 0, sx1y = 0, sx2y = 0;
    for (let i = 0; i < m; i++) {
      sx1x1 += x1[i] * x1[i]; sx1x2 += x1[i] * x2[i];
      sx2x2 += x2[i] * x2[i]; sx1y += x1[i] * y[i]; sx2y += x2[i] * y[i];
    }
    const det = sx1x1 * sx2x2 - sx1x2 * sx1x2;
    if (Math.abs(det) < 1e-10) return 0;
    const phi1 = (sx2x2 * sx1y - sx1x2 * sx2y) / det;
    const phi2 = (sx1x1 * sx2y - sx1x2 * sx1y) / det;
    const disc = phi1 * phi1 + 4 * phi2;
    const ev = disc >= 0
      ? Math.max(Math.abs((phi1 + Math.sqrt(disc)) / 2), Math.abs((phi1 - Math.sqrt(disc)) / 2))
      : Math.sqrt(-phi2);
    return isNaN(ev) || ev > 2 ? 0 : ev;
  }

  function computeWtVsCancerFromCSV() {
    const datasetsDir = path.join(process.cwd(), 'datasets');

    const HUMAN_CLOCKS = new Set(['ARNTL', 'BMAL1', 'CLOCK', 'PER1', 'PER2', 'CRY1', 'CRY2',
      'NR1D1', 'NR1D2', 'DBP', 'TEF', 'NPAS2', 'RORA', 'RORC']);
    const HUMAN_TARGETS = new Set(['WEE1', 'MYC', 'CCND1', 'CCNB1', 'CDK1', 'MKI67', 'CDKN1A',
      'CDKN1B', 'MCM6', 'E2F1', 'E2F3', 'CDC20', 'PLK1', 'AURKA']);

    function readGeneEigenvalues(file: string, isEnsembl = false): Map<string, number> {
      const fp = path.join(datasetsDir, file);
      if (!fs.existsSync(fp)) return new Map();
      const lines = fs.readFileSync(fp, 'utf-8').trim().split('\n');
      const result = new Map<string, number>();
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',');
        const raw = cols[0]?.trim().replace(/"/g, '');
        if (!raw) continue;
        const symbol = isEnsembl ? (ENSEMBL_TO_SYMBOL[raw] || null) : raw;
        if (!symbol) continue;
        const upper = symbol.toUpperCase();
        if (!HUMAN_CLOCKS.has(upper) && !HUMAN_TARGETS.has(upper)) continue;
        const vals = cols.slice(1).map(v => parseFloat(v.trim())).filter(v => !isNaN(v) && isFinite(v));
        if (vals.length < 5) continue;
        const ev = fitAR2Eigenvalue(vals);
        if (ev > 0 && ev <= 1.5) result.set(upper, ev);
      }
      return result;
    }

    // Healthy: GSE113883 human whole blood (circadian), GSE48113 human blood
    // Cancer: GSE221103 MYC-ON neuroblastoma, MYC-OFF as disrupted context
    const healthyFiles = [
      { file: 'GSE113883_Human_WholeBlood.csv', label: 'GSE113883_WholeBlood' },
      { file: 'GSE48113_Human_Blood_Circadian.csv', label: 'GSE48113_Blood' },
    ];
    const cancerFiles = [
      { file: 'GSE221103_Neuroblastoma_MYC_ON.csv', label: 'GSE221103_MYC-ON' },
      { file: 'GSE221173_U2OS_MYC_ON.csv', label: 'GSE221173_U2OS_MYC-ON' },
    ];

    const healthyMaps = healthyFiles.map(f => ({ label: f.label, genes: readGeneEigenvalues(f.file) }))
      .filter(d => d.genes.size > 0);
    const cancerMaps = cancerFiles.map(f => ({ label: f.label, genes: readGeneEigenvalues(f.file) }))
      .filter(d => d.genes.size > 0);

    if (healthyMaps.length === 0 || cancerMaps.length === 0) return null;

    const SIG_THRESHOLD = 0.57;

    const allComparisons: Array<{
      clockGene: string; targetGene: string;
      healthySignificant: number; healthyTotal: number; healthyRate: number;
      cancerSignificant: number; cancerTotal: number; cancerRate: number;
      pattern: 'LOST_IN_CANCER' | 'GAINED_IN_CANCER' | 'STABLE' | 'VARIABLE';
      rateDifference: number;
      healthyClockEv: number; cancerClockEv: number;
      healthyTargetEv: number; cancerTargetEv: number;
    }> = [];

    for (const clockGene of Array.from(HUMAN_CLOCKS)) {
      for (const targetGene of Array.from(HUMAN_TARGETS)) {
        let healthySig = 0, cancerSig = 0;
        let sumHealthyClock = 0, sumHealthyTarget = 0, sumCancerClock = 0, sumCancerTarget = 0;
        let nhc = 0, nht = 0, ncc = 0, nct = 0;

        for (const d of healthyMaps) {
          const cev = d.genes.get(clockGene); const tev = d.genes.get(targetGene);
          if (cev !== undefined) { sumHealthyClock += cev; nhc++; }
          if (tev !== undefined) { sumHealthyTarget += tev; nht++; }
          if (cev !== undefined && tev !== undefined && cev > SIG_THRESHOLD && cev > tev) healthySig++;
        }
        for (const d of cancerMaps) {
          const cev = d.genes.get(clockGene); const tev = d.genes.get(targetGene);
          if (cev !== undefined) { sumCancerClock += cev; ncc++; }
          if (tev !== undefined) { sumCancerTarget += tev; nct++; }
          if (cev !== undefined && tev !== undefined && cev > SIG_THRESHOLD && cev > tev) cancerSig++;
        }

        if (nhc === 0 && nht === 0) continue;

        const healthyRate = healthyMaps.length > 0 ? healthySig / healthyMaps.length : 0;
        const cancerRate = cancerMaps.length > 0 ? cancerSig / cancerMaps.length : 0;
        const diff = cancerRate - healthyRate;

        let pattern: 'LOST_IN_CANCER' | 'GAINED_IN_CANCER' | 'STABLE' | 'VARIABLE';
        if (healthyRate >= 0.5 && cancerRate < 0.2) pattern = 'LOST_IN_CANCER';
        else if (healthyRate < 0.2 && cancerRate >= 0.5) pattern = 'GAINED_IN_CANCER';
        else if (Math.abs(diff) < 0.2) pattern = 'STABLE';
        else pattern = 'VARIABLE';

        allComparisons.push({
          clockGene, targetGene, healthyTotal: healthyMaps.length, cancerTotal: cancerMaps.length,
          healthySignificant: healthySig, cancerSignificant: cancerSig,
          healthyRate: Math.round(healthyRate * 100) / 100,
          cancerRate: Math.round(cancerRate * 100) / 100,
          rateDifference: Math.round(diff * 100) / 100,
          pattern,
          healthyClockEv: nhc > 0 ? Math.round((sumHealthyClock / nhc) * 1000) / 1000 : 0,
          cancerClockEv: ncc > 0 ? Math.round((sumCancerClock / ncc) * 1000) / 1000 : 0,
          healthyTargetEv: nht > 0 ? Math.round((sumHealthyTarget / nht) * 1000) / 1000 : 0,
          cancerTargetEv: nct > 0 ? Math.round((sumCancerTarget / nct) * 1000) / 1000 : 0,
        });
      }
    }

    allComparisons.sort((a, b) => Math.abs(b.rateDifference) - Math.abs(a.rateDifference));
    const lostInCancer = allComparisons.filter(c => c.pattern === 'LOST_IN_CANCER');
    const gainedInCancer = allComparisons.filter(c => c.pattern === 'GAINED_IN_CANCER');

    return {
      summary: {
        healthyDatasetsAnalyzed: healthyMaps.length,
        cancerDatasetsAnalyzed: cancerMaps.length,
        totalPairsCompared: allComparisons.length,
        patternsFound: {
          lostInCancer: lostInCancer.length,
          gainedInCancer: gainedInCancer.length,
          stable: allComparisons.filter(c => c.pattern === 'STABLE').length,
          variable: allComparisons.filter(c => c.pattern === 'VARIABLE').length,
        },
        note: 'Pre-computed from GSE113883 (healthy human blood) vs GSE221103 MYC-ON (neuroblastoma). Clock hierarchy significance = clock eigenvalue > target eigenvalue AND clock |λ| > 0.57.'
      },
      keyFindings: { lostInCancer: lostInCancer.slice(0, 5), gainedInCancer: gainedInCancer.slice(0, 5) },
      allComparisons,
    };
  }

  let wtVsCancerCache: ReturnType<typeof computeWtVsCancerFromCSV> | null = null;

  app.get("/api/analyses/cross-context-comparison", async (req, res) => {
    try {
      const allRuns = await storage.getAllAnalysisRuns();
      
      const healthyRuns = allRuns.filter(run => 
        run.status === 'completed' && 
        (run.datasetName.includes('GSE54650') || 
         run.datasetName.includes('APC-WT_BMAL-WT') ||
         run.datasetName.includes('MYC-OFF'))
      );
      
      const cancerRuns = allRuns.filter(run => 
        run.status === 'completed' && 
        (run.datasetName.includes('APC-Mut') || 
         run.datasetName.includes('MYC-ON'))
      );
      
      if (healthyRuns.length === 0 || cancerRuns.length === 0) {
        if (!wtVsCancerCache) wtVsCancerCache = computeWtVsCancerFromCSV();
        if (wtVsCancerCache) return res.json(wtVsCancerCache);
        return res.json({
          message: "Need both healthy and cancer/mutant analyses for comparison.",
          healthyCount: healthyRuns.length,
          cancerCount: cancerRuns.length,
          comparisons: []
        });
      }
      
      interface ContextDataCC {
        significantCount: number;
        totalTests: number;
        meanPValue: number;
        pValues: number[];
        effectSizes: number[];
      }
      
      const healthyPairs = new Map<string, ContextDataCC>();
      const cancerPairs = new Map<string, ContextDataCC>();
      
      const collectPairsCC = async (runs: typeof allRuns, map: Map<string, ContextDataCC>) => {
        for (const run of runs) {
          const hypotheses = await storage.getHypothesesByRunId(run.id);
          for (const hyp of hypotheses) {
            if (hyp.pValue === 1 || hyp.pValue === null) continue;
            
            const key = `${hyp.targetGene}|${hyp.clockGene}`;
            if (!map.has(key)) {
              map.set(key, {
                significantCount: 0,
                totalTests: 0,
                meanPValue: 0,
                pValues: [],
                effectSizes: []
              });
            }
            
            const data = map.get(key)!;
            data.totalTests++;
            data.pValues.push(hyp.pValue);
            if (hyp.significant) data.significantCount++;
            if (hyp.effectSizeCohensF2) data.effectSizes.push(hyp.effectSizeCohensF2);
          }
        }
        
        const entries = Array.from(map.entries());
        for (const [, data] of entries) {
          data.meanPValue = data.pValues.reduce((a: number, b: number) => a + b, 0) / data.pValues.length;
        }
      };
      
      await collectPairsCC(healthyRuns, healthyPairs);
      await collectPairsCC(cancerRuns, cancerPairs);
      
      const allKeys = new Set([...Array.from(healthyPairs.keys()), ...Array.from(cancerPairs.keys())]);
      
      const comparisons = Array.from(allKeys).map(key => {
        const [targetGene, clockGene] = key.split('|');
        const healthy = healthyPairs.get(key);
        const cancer = cancerPairs.get(key);
        
        const healthySig = healthy?.significantCount || 0;
        const cancerSig = cancer?.significantCount || 0;
        const healthyRate = healthy ? healthySig / healthy.totalTests : 0;
        const cancerRate = cancer ? cancerSig / cancer.totalTests : 0;
        
        let pattern: 'LOST_IN_CANCER' | 'GAINED_IN_CANCER' | 'STABLE' | 'VARIABLE';
        if (healthyRate > 0.5 && cancerRate < 0.2) {
          pattern = 'LOST_IN_CANCER';
        } else if (healthyRate < 0.2 && cancerRate > 0.5) {
          pattern = 'GAINED_IN_CANCER';
        } else if (Math.abs(healthyRate - cancerRate) < 0.2) {
          pattern = 'STABLE';
        } else {
          pattern = 'VARIABLE';
        }
        
        return {
          targetGene,
          clockGene,
          healthySignificant: healthySig,
          healthyTotal: healthy?.totalTests || 0,
          healthyRate: Math.round(healthyRate * 100) / 100,
          cancerSignificant: cancerSig,
          cancerTotal: cancer?.totalTests || 0,
          cancerRate: Math.round(cancerRate * 100) / 100,
          pattern,
          rateDifference: Math.round((cancerRate - healthyRate) * 100) / 100
        };
      }).filter(c => c.healthyTotal > 0 || c.cancerTotal > 0)
        .sort((a, b) => Math.abs(b.rateDifference) - Math.abs(a.rateDifference));
      
      const lostInCancer = comparisons.filter(c => c.pattern === 'LOST_IN_CANCER');
      const gainedInCancer = comparisons.filter(c => c.pattern === 'GAINED_IN_CANCER');
      
      res.json({
        summary: {
          healthyDatasetsAnalyzed: healthyRuns.length,
          cancerDatasetsAnalyzed: cancerRuns.length,
          totalPairsCompared: comparisons.length,
          patternsFound: {
            lostInCancer: lostInCancer.length,
            gainedInCancer: gainedInCancer.length,
            stable: comparisons.filter(c => c.pattern === 'STABLE').length,
            variable: comparisons.filter(c => c.pattern === 'VARIABLE').length
          }
        },
        keyFindings: {
          lostInCancer: lostInCancer.slice(0, 20),
          gainedInCancer: gainedInCancer.slice(0, 20)
        },
        allComparisons: comparisons,
        interpretation: {
          LOST_IN_CANCER: "Gating relationship present in healthy tissue but lost in cancer - suggests protective mechanism disrupted",
          GAINED_IN_CANCER: "Gating relationship absent in healthy but present in cancer - suggests compensatory or oncogenic mechanism",
          STABLE: "Similar gating in both contexts - likely core circadian function",
          VARIABLE: "Inconsistent pattern - may be tissue or context specific"
        }
      });
      
    } catch (error) {
      console.error("Error computing cross-context comparison:", error);
      res.status(500).json({ error: "Failed to compute cross-context comparison" });
    }
  });

  // Get specific analysis run with hypotheses
  app.get("/api/analyses/:id", async (req, res) => {
    try {
      const run = await storage.getAnalysisRun(req.params.id);
      if (!run) {
        return res.status(404).json({ error: "Analysis run not found" });
      }
      const hypotheses = await storage.getHypothesesByRunId(req.params.id);
      
      // Compute FDR-adjusted p-values for hypotheses with valid p-values
      const validPValues = hypotheses
        .map((h, i) => ({ index: i, pValue: h.pValue }))
        .filter(item => item.pValue !== null && item.pValue !== undefined && item.pValue < 1);
      
      const pValuesArray = validPValues.map(item => item.pValue as number);
      const { qValues } = benjaminiHochberg(pValuesArray);
      
      // Create a map of original index to q-value
      const qValueMap = new Map<number, number>();
      validPValues.forEach((item, i) => {
        qValueMap.set(item.index, qValues[i]);
      });
      
      // Add FDR-adjusted p-values and model quality to hypotheses
      const enhancedHypotheses = hypotheses.map((h, i) => {
        const qValue = qValueMap.get(i);
        const fdrAdjustedPValue = qValue !== undefined ? qValue : (h.pValue === 1 ? 1 : null);
        
        // Model quality based on p-value strength and FDR
        let modelQuality: 'high' | 'medium' | 'low' = 'low';
        if (h.pValue !== null && h.pValue < 0.01 && fdrAdjustedPValue !== null && fdrAdjustedPValue < 0.1) {
          modelQuality = 'high';
        } else if (h.pValue !== null && h.pValue < 0.05) {
          modelQuality = 'medium';
        }
        
        return {
          ...h,
          fdrAdjustedPValue,
          modelQuality
        };
      });
      
      const artifactWarnings: { targetGene: string; warning: string; clockCount: number; sharedF2: number }[] = [];
      const sigByTarget = new Map<string, { clockGene: string; f2: number }[]>();
      for (const h of enhancedHypotheses) {
        if (h.significant && h.effectSizeCohensF2 != null && h.effectSizeCohensF2 > 0) {
          const arr = sigByTarget.get(h.targetGene) || [];
          arr.push({ clockGene: h.clockGene, f2: h.effectSizeCohensF2 });
          sigByTarget.set(h.targetGene, arr);
        }
      }
      for (const [target, entries] of sigByTarget.entries()) {
        if (entries.length >= 4) {
          const f2Values = entries.map(e => e.f2);
          const f2Mean = f2Values.reduce((a, b) => a + b, 0) / f2Values.length;
          const f2Variance = f2Values.reduce((s, v) => s + (v - f2Mean) ** 2, 0) / f2Values.length;
          const cv = f2Mean > 0 ? Math.sqrt(f2Variance) / f2Mean : 0;
          if (cv < 0.05) {
            artifactWarnings.push({
              targetGene: target,
              warning: `${target} shows near-identical effect sizes (f² ≈ ${f2Mean.toFixed(2)}, CV=${(cv*100).toFixed(1)}%) across ${entries.length} clock genes. This may indicate a single underlying periodic profile correlating with any oscillatory regressor rather than ${entries.length} independent biological gating relationships. Interpret with caution.`,
              clockCount: entries.length,
              sharedF2: Math.round(f2Mean * 100) / 100
            });
          }
        }
      }

      res.json({ run, hypotheses: enhancedHypotheses, artifactWarnings });
    } catch (error) {
      console.error("Error fetching analysis:", error);
      res.status(500).json({ error: "Failed to fetch analysis" });
    }
  });

  // Method Comparison: PAR(2) vs Cosinor Rhythmicity
  // Returns rhythmicity metrics for both clock and target genes alongside PAR(2) results
  app.get("/api/analyses/:runId/hypothesis/:hypothesisId/method-comparison", async (req, res) => {
    try {
      const { runId, hypothesisId } = req.params;
      
      const run = await storage.getAnalysisRun(runId);
      if (!run) {
        return res.status(404).json({ error: "Analysis run not found" });
      }
      
      const hypotheses = await storage.getHypothesesByRunId(runId);
      const hypothesis = hypotheses.find((h: any) => h.id === hypothesisId);
      
      if (!hypothesis) {
        return res.status(404).json({ error: "Hypothesis not found" });
      }
      
      // Get dataset to compute rhythmicity for target gene
      const datasetName = run.datasetName;
      const datasetsDir = path.join(process.cwd(), 'datasets');
      const possiblePaths = [
        path.join(datasetsDir, datasetName),
        path.join(datasetsDir, datasetName + '.csv'),
        path.join(datasetsDir, datasetName + '.csv.gz'),
      ];
      
      let parsedData: ParsedDataset | null = null;
      for (const filepath of possiblePaths) {
        if (fs.existsSync(filepath)) {
          try {
            const buffer = fs.readFileSync(filepath);
            parsedData = await parseDatasetBuffer(buffer, path.basename(filepath));
            break;
          } catch (e) {
            console.warn(`Failed to parse ${filepath}: ${e}`);
          }
        }
      }
      
      if (!parsedData) {
        return res.json({
          available: false,
          message: "Dataset not available for rhythmicity comparison"
        });
      }
      
      // Find clock and target gene data
      const clockGene = CLOCKS.find(c => c.name === hypothesis.clockGene);
      const targetGene = CANDIDATES.find(c => c.name === hypothesis.targetGene);
      
      const clockData = clockGene ? findGeneData(parsedData, clockGene) : null;
      const targetData = targetGene ? findGeneData(parsedData, targetGene) : null;
      
      const period = 24; // Standard circadian period
      
      // Compute rhythmicity for clock gene
      let clockRhythmicity: ClockRhythmicityCheck | null = null;
      if (clockData && clockData.length >= 6) {
        clockRhythmicity = checkClockRhythmicity(parsedData.timepoints, clockData, period);
      }
      
      // Compute rhythmicity for target gene (using same cosinor method)
      let targetRhythmicity: ClockRhythmicityCheck | null = null;
      if (targetData && targetData.length >= 6) {
        targetRhythmicity = checkClockRhythmicity(parsedData.timepoints, targetData, period);
      }
      
      // Generate comparison interpretation with enhanced logic from proposal
      const par2Significant = hypothesis.significant === true;
      const clockIsRhythmic = clockRhythmicity?.isRhythmic === true;
      const targetIsRhythmic = targetRhythmicity?.isRhythmic === true;
      
      let label = "";
      let explanation = "";
      let confidenceLevel: "HIGH" | "MEDIUM" | "LOW" = "LOW";
      let par2Specific = false;
      
      if (par2Significant && clockIsRhythmic && targetIsRhythmic) {
        confidenceLevel = "HIGH";
        label = "Strongly supported gating";
        explanation = "Both clock and target show clear 24h rhythms, and PAR(2) detects significant phase-gating. Result is well-supported by both methods.";
        par2Specific = false;
      } else if (par2Significant && clockIsRhythmic && !targetIsRhythmic) {
        confidenceLevel = "MEDIUM";
        label = "PAR(2)-specific gating";
        explanation = "The clock gene is rhythmic, the target does not show clear 24h oscillation, but PAR(2) detects significant phase-dependent gating. This is a PAR(2)-specific finding that standard rhythm tools would miss.";
        par2Specific = true;
      } else if (par2Significant && !clockIsRhythmic) {
        confidenceLevel = "LOW";
        label = "Unstable gating (clock not rhythmic)";
        explanation = "PAR(2) reports significant gating, but the clock gene itself does not show a robust 24h rhythm by cosinor. This result should be treated with caution.";
        par2Specific = true;
      } else if (!par2Significant && clockIsRhythmic) {
        confidenceLevel = "LOW";
        label = "Rhythmic but no gating";
        explanation = "The clock (and possibly the target) are rhythmic by cosinor, but PAR(2) does not detect significant phase-dependent gating between them.";
        par2Specific = false;
      } else {
        confidenceLevel = "LOW";
        label = "No support";
        explanation = "Neither PAR(2) nor cosinor provide clear evidence for a robust clock–target relationship in this pair.";
        par2Specific = false;
      }
      
      res.json({
        available: true,
        runId,
        hypothesisId,
        datasetName: run.datasetName,
        par2: {
          clockGene: hypothesis.clockGene,
          targetGene: hypothesis.targetGene,
          pValue: hypothesis.pValue,
          fdr: hypothesis.qValue ?? null,
          effectSize: hypothesis.effectSizeCohensF2 ?? null,
          isSignificant: par2Significant,
          rSquaredChange: hypothesis.rSquaredChange ?? null
        },
        cosinor: {
          clock: clockRhythmicity ? {
            amplitude: clockRhythmicity.relativeAmplitude,
            phase: clockRhythmicity.peakTime,
            r2: clockRhythmicity.rSquared,
            pValue: clockRhythmicity.pValue,
            isRhythmic: clockRhythmicity.isRhythmic
          } : null,
          target: targetRhythmicity ? {
            amplitude: targetRhythmicity.relativeAmplitude,
            phase: targetRhythmicity.peakTime,
            r2: targetRhythmicity.rSquared,
            pValue: targetRhythmicity.pValue,
            isRhythmic: targetRhythmicity.isRhythmic
          } : null
        },
        confidence: {
          level: confidenceLevel,
          label,
          explanation,
          par2Specific
        }
      });
      
    } catch (error) {
      console.error("Error computing method comparison:", error);
      res.status(500).json({ error: "Failed to compute method comparison" });
    }
  });

  // Phase-sorted heatmap data for visualization
  app.get("/api/analyses/:id/phase-heatmap", async (req, res) => {
    try {
      const run = await storage.getAnalysisRun(req.params.id);
      if (!run) {
        return res.status(404).json({ error: "Analysis run not found" });
      }
      
      const hypotheses = await storage.getHypothesesByRunId(req.params.id);
      
      // Get the dataset
      const datasetName = run.datasetName;
      const datasetsDir = path.join(process.cwd(), 'datasets');
      const possiblePaths = [
        path.join(datasetsDir, datasetName),
        path.join(datasetsDir, datasetName + '.csv'),
        path.join(datasetsDir, datasetName + '.csv.gz'),
      ];
      
      let parsedData: ParsedDataset | null = null;
      for (const filepath of possiblePaths) {
        if (fs.existsSync(filepath)) {
          try {
            const buffer = fs.readFileSync(filepath);
            parsedData = await parseDatasetBuffer(buffer, path.basename(filepath));
            break;
          } catch (e) {
            console.warn(`Failed to parse ${filepath}: ${e}`);
          }
        }
      }
      
      if (!parsedData) {
        return res.status(404).json({ error: "Dataset not available for heatmap" });
      }
      
      const { geneTimeSeries, timepoints } = parsedData;
      const period = 24;
      const omega = 2 * Math.PI / period;
      const availableGenes = Array.from(geneTimeSeries.keys());
      
      // Collect unique genes from hypotheses
      const genesInAnalysis = new Set<string>();
      hypotheses.forEach((h: any) => {
        genesInAnalysis.add(h.clockGene);
        genesInAnalysis.add(h.targetGene);
      });
      
      // Calculate phase for each gene and collect expression data
      const genePhaseData: Array<{
        gene: string;
        phase: number;
        peakTime: number;
        amplitude: number;
        expression: number[];
        normalizedExpression: number[];
        isClockGene: boolean;
        pValue?: number;
        eigenvalue?: number;
      }> = [];
      
      const clockGeneNames = ['Arntl', 'Bmal1', 'Clock', 'Cry1', 'Cry2', 'Per1', 'Per2', 'Per3', 'Nr1d1', 'Nr1d2', 'Dbp', 'Tef', 'Npas2', 'Rorc', 'CCA1', 'LHY', 'TOC1', 'PRR5', 'PRR7', 'PRR9', 'GI', 'ELF3'];
      
      for (const gene of genesInAnalysis) {
        if (!gene || typeof gene !== 'string') continue;
        const resolvedGene = resolveGeneName(gene, availableGenes) || gene;
        const expr = geneTimeSeries.get(resolvedGene) || geneTimeSeries.get(gene) || geneTimeSeries.get(gene.toUpperCase()) || geneTimeSeries.get(gene.toLowerCase());
        
        if (!expr || expr.length < 4) continue;
        
        // Fit cosine to get phase
        const n = Math.min(expr.length, timepoints.length);
        const time = timepoints.slice(0, n);
        const expression = expr.slice(0, n);
        const meanExpr = expression.reduce((a, b) => a + b, 0) / n;
        const centeredExpr = expression.map(e => e - meanExpr);
        
        let sumCosSq = 0, sumSinSq = 0, sumCosSin = 0;
        let sumExprCos = 0, sumExprSin = 0;
        
        for (let i = 0; i < n; i++) {
          const theta = omega * time[i];
          const c = Math.cos(theta);
          const s = Math.sin(theta);
          sumCosSq += c * c;
          sumSinSq += s * s;
          sumCosSin += c * s;
          sumExprCos += centeredExpr[i] * c;
          sumExprSin += centeredExpr[i] * s;
        }
        
        const det = sumCosSq * sumSinSq - sumCosSin * sumCosSin;
        let phase = 0;
        let amplitude = 0;
        
        if (Math.abs(det) > 1e-10) {
          const a = (sumSinSq * sumExprCos - sumCosSin * sumExprSin) / det;
          const b = (sumCosSq * sumExprSin - sumCosSin * sumExprCos) / det;
          phase = Math.atan2(b, a);
          amplitude = Math.sqrt(a * a + b * b);
        }
        
        // Convert phase to peak time (0-24h)
        const peakTime = (((-phase / omega) % period) + period) % period;
        
        // Normalize expression to 0-1 range
        const minExpr = Math.min(...expression);
        const maxExpr = Math.max(...expression);
        const range = maxExpr - minExpr;
        const normalizedExpression = range > 0 
          ? expression.map(e => (e - minExpr) / range)
          : expression.map(() => 0.5);
        
        // Compute AR(2) eigenvalue directly from expression time series (OLS)
        let computedEigenvalue: number | undefined;
        if (n >= 4) {
          const y = centeredExpr;
          // Build lag matrix: y[t] = phi1*y[t-1] + phi2*y[t-2]
          let s11 = 0, s12 = 0, s22 = 0, sy1 = 0, sy2 = 0;
          for (let t = 2; t < n; t++) {
            s11 += y[t-1] * y[t-1];
            s12 += y[t-1] * y[t-2];
            s22 += y[t-2] * y[t-2];
            sy1 += y[t] * y[t-1];
            sy2 += y[t] * y[t-2];
          }
          const detAR = s11 * s22 - s12 * s12;
          if (Math.abs(detAR) > 1e-12) {
            const phi1 = (sy1 * s22 - sy2 * s12) / detAR;
            const phi2 = (sy2 * s11 - sy1 * s12) / detAR;
            const disc = phi1 * phi1 + 4 * phi2;
            if (disc >= 0) {
              computedEigenvalue = Math.max(
                Math.abs((phi1 + Math.sqrt(disc)) / 2),
                Math.abs((phi1 - Math.sqrt(disc)) / 2)
              );
            } else {
              computedEigenvalue = Math.sqrt(-phi2);
            }
            if (isNaN(computedEigenvalue) || !isFinite(computedEigenvalue)) {
              computedEigenvalue = undefined;
            }
          }
        }

        // Get analysis result for this gene if it's a target (use stored value if available)
        const hypothesis = hypotheses.find((h: any) => h.targetGene === gene);
        const eigenvalue = hypothesis?.eigenvalueModulus ?? computedEigenvalue;

        genePhaseData.push({
          gene,
          phase,
          peakTime,
          amplitude: meanExpr > 0 ? amplitude / meanExpr : 0,
          expression,
          normalizedExpression,
          isClockGene: clockGeneNames.some(c => gene.toLowerCase().includes(c.toLowerCase())),
          pValue: hypothesis?.pValue ?? undefined,
          eigenvalue
        });
      }
      
      // Sort by peak time (phase)
      genePhaseData.sort((a, b) => a.peakTime - b.peakTime);
      
      res.json({
        genes: genePhaseData,
        timepoints,
        period,
        datasetName: run.datasetName,
        analysisName: run.name
      });
    } catch (error: any) {
      console.error("Error generating phase heatmap:", error?.message || error, error?.stack);
      res.status(500).json({ error: "Failed to generate phase heatmap data", details: error?.message });
    }
  });

  // Run null survey for a specific analysis run
  app.get("/api/analyses/:id/null-survey", async (req, res) => {
    try {
      const run = await storage.getAnalysisRun(req.params.id);
      if (!run) {
        return res.status(404).json({ error: "Analysis run not found" });
      }
      
      const hypotheses = await storage.getHypothesesByRunId(req.params.id);
      
      // Get the dataset path for this analysis
      const datasetName = run.datasetName;
      let parsedData: ParsedDataset | null = null;
      
      // Try to find the dataset file
      const datasetsDir = path.join(process.cwd(), 'datasets');
      const possiblePaths = [
        path.join(datasetsDir, datasetName),
        path.join(datasetsDir, datasetName + '.csv'),
        path.join(datasetsDir, datasetName + '.csv.gz'),
      ];
      
      for (const filepath of possiblePaths) {
        if (fs.existsSync(filepath)) {
          try {
            const buffer = fs.readFileSync(filepath);
            parsedData = await parseDatasetBuffer(buffer, path.basename(filepath));
            break;
          } catch (e) {
            console.warn(`Failed to parse ${filepath}: ${e}`);
          }
        }
      }
      
      if (!parsedData) {
        // Use theoretical null distribution
        const validHypotheses = hypotheses.filter(h => h.pValue !== null && h.pValue < 1);
        const significantCount = validHypotheses.filter(h => h.significant).length;
        const significantRate = validHypotheses.length > 0 ? significantCount / validHypotheses.length : 0;
        const expectedRate = 0.05;
        
        return res.json({
          nPermutations: 0,
          nullSignificantRate: expectedRate,
          nullMeanPValue: 0.5,
          nullMedianPValue: 0.5,
          realSignificantCount: significantCount,
          realMeanPValue: validHypotheses.length > 0 
            ? validHypotheses.reduce((sum, h) => sum + (h.pValue || 1), 0) / validHypotheses.length 
            : 1,
          exceedsNull: significantRate > expectedRate * 2,
          enrichmentRatio: significantRate / expectedRate,
          interpretation: significantRate > expectedRate * 3
            ? `Strong signal: ${significantCount} significant pairs (${(significantRate * 100).toFixed(1)}%) exceeds null expectation`
            : significantRate > expectedRate * 2
              ? `Moderate signal: Results exceed null distribution`
              : significantCount === 0
                ? 'No significant pairs detected - consistent with null'
                : `Results within null range - findings may be false positives`,
          note: 'Theoretical null distribution used (dataset not found for permutation)'
        });
      }
      
      // Run actual permutation tests
      const realResults = hypotheses
        .filter(h => h.pValue !== null && h.pValue < 1)
        .map(h => ({ pValue: h.pValue as number, significant: h.significant }));
      
      const nullSurvey = runQuickNullSurvey(
        parsedData.geneTimeSeries,
        parsedData.timepoints,
        realResults,
        100  // Robust null survey with 100 permutations for real-time analysis
      );
      
      res.json(nullSurvey);
    } catch (error) {
      console.error("Error running null survey:", error);
      res.status(500).json({ error: "Failed to run null survey" });
    }
  });

  // Get list of embedded datasets
  app.get("/api/datasets/embedded", async (req, res) => {
    try {
      const datasetsDir = path.join(process.cwd(), 'datasets');
      // AR2 results files and metadata files should not appear as clickable datasets
      const EXCLUDED_SUFFIXES = ['_AR2_results.csv', '_AR2_12pt.csv', '_AR2.csv'];
      const EXCLUDED_EXACT = new Set([
        'GSE24416_GSE3830_GSE6491_AR2_results.csv',
        'GSE157357_WT_AR2_12pt.csv',
        'GSE161566_Human_Enteroid_AR2.csv',
      ]);
      const files = fs.readdirSync(datasetsDir).filter(f => 
        f.endsWith('.csv') &&
        !EXCLUDED_EXACT.has(f) &&
        !EXCLUDED_SUFFIXES.some(s => f.endsWith(s)) &&
        (
          f.startsWith('GSE') || 
          f.startsWith('human_plasma') || 
          f.startsWith('mouse_liver') ||
          f.startsWith('cgm_circadian') ||
          f.startsWith('shanghai_t2dm') ||
          f.startsWith('Arbeitman') ||
          f.startsWith('Zaas') ||
          f.startsWith('Amit')
        )
      );
      
      const datasets = files.map(filename => {
        // Parse filename to extract info
        // GSE54650 tissues: GSE54650_Liver_circadian.csv -> { tissue: "Liver", type: "tissue" }
        // GSE157357 organoids: GSE157357_Organoid_WT-WT_circadian.csv -> { condition: "WT-WT", type: "organoid" }
        
        const tissueMatch = filename.match(/^(GSE54650)_(.+)_circadian\.csv$/);
        if (tissueMatch) {
          const tissue = tissueMatch[2].replace(/_/g, ' ');
          return {
            id: filename.replace('.csv', ''),
            filename,
            study: tissueMatch[1],
            type: 'tissue',
            tissue,
            condition: null,
            description: `Mouse ${tissue} - Hughes Circadian Atlas`
          };
        }
        
        const organoidMatch = filename.match(/^(GSE157357)_Organoid_(.+)_circadian\.csv$/);
        if (organoidMatch) {
          const condition = organoidMatch[2];
          const conditionLabels: Record<string, string> = {
            'WT-WT': 'Wild-type',
            'WT-BmalKO': 'BMAL1 Knockout',
            'ApcKO-WT': 'APC Knockout',
            'ApcKO-BmalKO': 'APC + BMAL1 Knockout'
          };
          return {
            id: filename.replace('.csv', ''),
            filename,
            study: organoidMatch[1],
            type: 'organoid',
            tissue: 'Intestinal Organoid',
            condition: conditionLabels[condition] || condition,
            description: `Mouse Intestinal Organoid - ${conditionLabels[condition] || condition}`
          };
        }
        
        // GSE221103 Neuroblastoma (Human cell lines)
        const neuroMatch = filename.match(/^(GSE221103)_Neuroblastoma_(.+)\.csv$/);
        if (neuroMatch) {
          const condition = neuroMatch[2];
          const conditionLabels: Record<string, string> = {
            'MYC_ON': 'N-MYC Activated (Cancer Model)',
            'MYC_OFF': 'N-MYC Inactive (Control)'
          };
          return {
            id: filename.replace('.csv', ''),
            filename,
            study: neuroMatch[1],
            type: 'cancer',
            tissue: 'Neuroblastoma (SHEP)',
            condition,
            description: `Human Neuroblastoma - ${conditionLabels[condition] || condition}`
          };
        }
        
        // GSE17739 Kidney segments
        const kidneyMatch = filename.match(/^(GSE17739)_Kidney_(.+)\.csv$/);
        if (kidneyMatch) {
          const segment = kidneyMatch[2];
          const segmentLabels: Record<string, string> = {
            'DCT': 'Distal Convoluted Tubule/CNT',
            'CCD': 'Cortical Collecting Duct'
          };
          return {
            id: filename.replace('.csv', ''),
            filename,
            study: kidneyMatch[1],
            type: 'kidney',
            tissue: 'Mouse Kidney',
            condition: segment,
            description: `Mouse Kidney - ${segmentLabels[segment] || segment}`
          };
        }
        
        // GSE59396 Lung inflammation
        const lungMatch = filename.match(/^(GSE59396)_Lung_(.+)\.csv$/);
        if (lungMatch) {
          const condition = lungMatch[2];
          const conditionLabels: Record<string, string> = {
            'Basal': 'Healthy Baseline',
            'Endotoxemia': 'LPS-Induced Inflammation'
          };
          return {
            id: filename.replace('.csv', ''),
            filename,
            study: lungMatch[1],
            type: 'inflammation',
            tissue: 'Mouse Lung',
            condition,
            description: `Mouse Lung - ${conditionLabels[condition] || condition}`
          };
        }
        
        // GSE157357 alternate organoid format (APC-Mut_BMAL-WT style)
        const organoidAltMatch = filename.match(/^(GSE157357)_(APC-[A-Za-z]+)_(BMAL-[A-Za-z]+)\.csv$/);
        if (organoidAltMatch) {
          const apcCondition = organoidAltMatch[2];
          const bmalCondition = organoidAltMatch[3];
          const conditionLabels: Record<string, string> = {
            'APC-WT': 'Wild-type APC',
            'APC-Mut': 'APC Mutant',
            'BMAL-WT': 'Wild-type BMAL1',
            'BMAL-KO': 'BMAL1 Knockout'
          };
          return {
            id: filename.replace('.csv', ''),
            filename,
            study: organoidAltMatch[1],
            type: 'organoid',
            tissue: 'Intestinal Organoid',
            condition: `${apcCondition}_${bmalCondition}`,
            description: `Mouse Intestinal Organoid - ${conditionLabels[apcCondition] || apcCondition}, ${conditionLabels[bmalCondition] || bmalCondition}`
          };
        }
        
        // GSE179027 Mouse Intestinal Enteroid (Rosselot et al. 2022, subseries of GSE179028)
        if (filename === 'GSE179027_MouseEnteroid_circadian.csv') {
          return {
            id: filename.replace('.csv', ''),
            filename,
            study: 'GSE179027',
            type: 'enteroid',
            tissue: 'Mouse Intestinal Enteroid',
            condition: 'Wild-type',
            description: 'Mouse Intestinal Enteroid - 24 Timepoints, 2h Intervals (Rosselot 2022, GSE179028)'
          };
        }

        // GSE161566 Human Intestinal Enteroid (subseries of GSE179028)
        if (filename === 'GSE161566_HumanEnteroid_circadian.csv') {
          return {
            id: filename.replace('.csv', ''),
            filename,
            study: 'GSE161566',
            type: 'enteroid',
            tissue: 'Human Intestinal Enteroid',
            condition: 'Wild-type',
            description: 'Human Intestinal Enteroid - 24 Timepoints, 2h Intervals (Rosselot 2022, GSE179028)'
          };
        }

        // GSE201207 Young Kidney Aging
        if (filename === 'GSE201207_Young_Kidney_Aging.csv') {
          return {
            id: filename.replace('.csv', ''),
            filename,
            study: 'GSE201207',
            type: 'aging',
            tissue: 'Mouse Kidney',
            condition: 'Young',
            description: 'Mouse Kidney - Young Animals (Aging Study)'
          };
        }
        
        // GSE261698 Glial Circadian Translatome (Alzheimer's Model)
        const glialMatch = filename.match(/^(GSE261698)_(WT|APP)_Bulk\.csv$/);
        if (glialMatch) {
          const condition = glialMatch[2];
          const conditionLabels: Record<string, string> = {
            'WT': 'Wild-type (Healthy)',
            'APP': 'APP Model (Alzheimer\'s)'
          };
          return {
            id: filename.replace('.csv', ''),
            filename,
            study: glialMatch[1],
            type: 'neurodegeneration',
            tissue: 'Mouse Cortex (Glia)',
            condition,
            description: `Mouse Glial Translatome - ${conditionLabels[condition] || condition}`
          };
        }
        
        // Robles 2014 Mouse Liver Whole-Cell Proteome (PLOS Genetics)
        if (filename === 'robles2014_liver_proteome_circadian.csv') {
          return {
            id: filename.replace('.csv', ''),
            filename,
            study: 'Robles 2014',
            type: 'proteomics',
            tissue: 'Mouse Liver (whole-cell)',
            condition: 'Normal',
            description: 'Mouse Liver Whole-Cell Proteome - 3,072 proteins, 16 timepoints (PLOS Genetics)'
          };
        }
        
        // Human Plasma Proteome (Jóhönnuson et al. 2025)
        if (filename === 'human_plasma_proteome_diurnal_2025.csv') {
          return {
            id: filename.replace('.csv', ''),
            filename,
            study: 'Jóhönnuson 2025',
            type: 'proteomics',
            tissue: 'Human Plasma',
            condition: 'Healthy Adults',
            description: 'Human Plasma Proteome - 138 Diurnal Proteins (Healthy)'
          };
        }
        
        // Mouse Liver Circadian Proteomics (Wang et al. 2018)
        if (filename === 'mouse_liver_circadian_proteomics.csv') {
          return {
            id: filename.replace('.csv', ''),
            filename,
            study: 'Wang 2018',
            type: 'proteomics',
            tissue: 'Mouse Liver',
            condition: 'Nuclear Proteomics',
            description: 'Mouse Liver Nuclear Proteome - Circadian Clock Proteins'
          };
        }
        
        // CGM Circadian Combined (Colas 2019 + Synthetic)
        if (filename === 'cgm_circadian_combined.csv') {
          return {
            id: filename.replace('.csv', ''),
            filename,
            study: 'CGM Combined',
            type: 'metabolomics',
            tissue: 'Blood Glucose',
            condition: 'Continuous Monitoring',
            description: 'CGM Glucose - 118 Subjects (Colas 2019 + Synthetic)'
          };
        }
        
        // ShanghaiT2DM (Zhao et al. 2023)
        if (filename === 'shanghai_t2dm_circadian.csv') {
          return {
            id: filename.replace('.csv', ''),
            filename,
            study: 'Zhao 2023',
            type: 'metabolomics',
            tissue: 'Blood Glucose',
            condition: 'Type 2 Diabetes',
            description: 'ShanghaiT2DM - 10 T2D Patients (15-min CGM)'
          };
        }
        
        // GSE242964 Arabidopsis Circadian (Redmond et al. 2024)
        const arabidopsisMatch = filename.match(/^(GSE242964)_Arabidopsis(?:_clocks)?_Day([ABC])_CT-header\.csv$/);
        if (arabidopsisMatch) {
          const day = arabidopsisMatch[2];
          const isClockOnly = filename.includes('_clocks_');
          const dayLabels: Record<string, string> = {
            'A': 'Early Development',
            'B': 'Mid Development', 
            'C': 'Late Development'
          };
          return {
            id: filename.replace('.csv', ''),
            filename,
            study: arabidopsisMatch[1],
            type: 'plant',
            tissue: 'Arabidopsis Leaf',
            condition: `Day ${day} (${dayLabels[day]})${isClockOnly ? ' - Clock Genes' : ''}`,
            description: `Arabidopsis thaliana - ${dayLabels[day]}${isClockOnly ? ' (Clock Genes Only)' : ''} [Redmond 2024]`
          };
        }
        
        // GSE48113 Human Blood Circadian (Archer et al. 2014 - Forced Desynchrony Protocol)
        if (filename === 'GSE48113_Human_Blood_Circadian.csv') {
          return {
            id: filename.replace('.csv', ''),
            filename,
            study: 'GSE48113',
            type: 'human',
            tissue: 'Human Blood',
            condition: 'Forced Desynchrony',
            description: 'Human Blood Transcriptome - 287 Samples, 7 Timepoints (Archer 2014)'
          };
        }
        
        // GSE48113 Human Blood Clock Genes Only
        if (filename === 'GSE48113_Human_Blood_ClockGenes.csv') {
          return {
            id: filename.replace('.csv', ''),
            filename,
            study: 'GSE48113',
            type: 'human',
            tissue: 'Human Blood',
            condition: 'Clock Genes Only',
            description: 'Human Blood - 32 Clock/Target Genes (Archer 2014)'
          };
        }
        
        // GSE11923 Mouse Liver High-Resolution (1h sampling)
        if (filename === 'GSE11923_Liver_1h_48h.csv') {
          return {
            id: filename.replace('.csv', ''),
            filename,
            study: 'GSE11923',
            type: 'tissue',
            tissue: 'Mouse Liver',
            condition: '1h sampling, 48h',
            description: 'Mouse Liver - 1h Sampling, 48h Duration (Hughes 2009)'
          };
        }
        if (filename === 'GSE11923_Liver_1h_48h_genes.csv') {
          return {
            id: filename.replace('.csv', ''),
            filename,
            study: 'GSE11923',
            type: 'tissue',
            tissue: 'Mouse Liver',
            condition: '1h sampling (gene symbols)',
            description: 'Mouse Liver - 1h Sampling, Gene Symbols (Hughes 2009)'
          };
        }
        
        // GSE30411 Mouse Liver 2h Resolution
        if (filename === 'GSE30411_Liver_WT_2h_48h.csv') {
          return {
            id: filename.replace('.csv', ''),
            filename,
            study: 'GSE30411',
            type: 'tissue',
            tissue: 'Mouse Liver',
            condition: '2h Resolution',
            description: 'Mouse Liver - 2h Sampling, 48h Duration (Vollmers 2012)'
          };
        }
        if (filename === 'GSE30411_Liver_WT_2h_48h_genes.csv') {
          return {
            id: filename.replace('.csv', ''),
            filename,
            study: 'GSE30411',
            type: 'tissue',
            tissue: 'Mouse Liver',
            condition: '2h Resolution - Genes',
            description: 'Mouse Liver - 2h Sampling, Gene Symbols (Vollmers 2012)'
          };
        }
        
        // GSE98965 Baboon Circadian
        if (filename === 'GSE98965_baboon_FPKM.csv') {
          return {
            id: filename.replace('.csv', ''),
            filename,
            study: 'GSE98965',
            type: 'primate',
            tissue: 'Baboon Multi-tissue',
            condition: 'FPKM',
            description: 'Baboon Circadian Atlas - Multi-tissue FPKM (Mure 2018)'
          };
        }
        
        // GSE242964 Arabidopsis alternate formats
        if (filename === 'GSE242964_arabidopsis_circadian.csv') {
          return {
            id: filename.replace('.csv', ''),
            filename,
            study: 'GSE242964',
            type: 'plant',
            tissue: 'Arabidopsis',
            condition: 'Full Dataset',
            description: 'Arabidopsis thaliana - Full Expression Dataset (Redmond 2024)'
          };
        }
        if (filename === 'GSE242964_arabidopsis_circadian_averaged.csv') {
          return {
            id: filename.replace('.csv', ''),
            filename,
            study: 'GSE242964',
            type: 'plant',
            tissue: 'Arabidopsis',
            condition: 'Averaged',
            description: 'Arabidopsis thaliana - Replicate-Averaged (Redmond 2024)'
          };
        }
        
        // Sleep deprivation study
        if (filename === 'sleep_deprivation_circadian_genes.csv') {
          return {
            id: filename.replace('.csv', ''),
            filename,
            study: 'Sleep Study',
            type: 'human',
            tissue: 'Human Blood',
            condition: 'Sleep Deprivation',
            description: 'Human Blood - Sleep Deprivation Effects on Clock Genes'
          };
        }
        
        // GSE133342 Mouse Liver Constant Darkness
        if (filename === 'GSE133342_Liver_ConstantDarkness.csv') {
          return {
            id: filename.replace('.csv', ''),
            filename,
            study: 'GSE133342',
            type: 'tissue',
            tissue: 'Mouse Liver',
            condition: 'Constant Darkness',
            description: 'Mouse Liver - Constant Darkness 6-week DD Protocol (Chen 2020)'
          };
        }
        
        // GSE113883 Human Whole Blood Atlas (Braun 2018, TimeSignature)
        if (filename === 'GSE113883_Human_WholeBlood.csv') {
          return {
            id: filename.replace('.csv', ''),
            filename,
            study: 'GSE113883',
            type: 'human',
            tissue: 'Human Whole Blood',
            condition: 'Circadian Time Course',
            description: 'Human Whole Blood - Multi-Subject Time Course (Braun 2018)'
          };
        }
        
        if (filename === 'GSE107537_PBMC_Day_circadian.csv') {
          return {
            id: filename.replace('.csv', ''),
            filename,
            study: 'GSE107537',
            type: 'human',
            tissue: 'Human PBMC',
            condition: 'Day Schedule',
            description: 'Human PBMC - Normal Day-Oriented Schedule (Kervezee 2018)'
          };
        }
        if (filename === 'GSE107537_PBMC_Night_circadian.csv') {
          return {
            id: filename.replace('.csv', ''),
            filename,
            study: 'GSE107537',
            type: 'human',
            tissue: 'Human PBMC',
            condition: 'Night Shift',
            description: 'Human PBMC - Simulated Night Shift Schedule (Kervezee 2018)'
          };
        }
        if (filename === 'GSE122541_Nurses_DayShift_circadian.csv') {
          return {
            id: filename.replace('.csv', ''),
            filename,
            study: 'GSE122541',
            type: 'human',
            tissue: 'Human PBMC',
            condition: 'Day-Shift Nurses',
            description: 'Human PBMC - Day-Shift Hospital Nurses, 8 Timepoints (Gamble 2019)'
          };
        }
        if (filename === 'GSE122541_Nurses_NightShift_circadian.csv') {
          return {
            id: filename.replace('.csv', ''),
            filename,
            study: 'GSE122541',
            type: 'human',
            tissue: 'Human PBMC',
            condition: 'Night-Shift Nurses',
            description: 'Human PBMC - Night-Shift Hospital Nurses, 8 Timepoints (Gamble 2019)'
          };
        }
        if (filename === 'GSE39445_Blood_SufficientSleep_circadian.csv') {
          return {
            id: filename.replace('.csv', ''),
            filename,
            study: 'GSE39445',
            type: 'human',
            tissue: 'Human Leukocyte',
            condition: 'Sufficient Sleep',
            description: 'Human Leukocyte - After 1 Week Sufficient Sleep (Moller-Levet 2013)'
          };
        }
        if (filename === 'GSE39445_Blood_SleepRestriction_circadian.csv') {
          return {
            id: filename.replace('.csv', ''),
            filename,
            study: 'GSE39445',
            type: 'human',
            tissue: 'Human Leukocyte',
            condition: 'Sleep Restriction',
            description: 'Human Leukocyte - After 1 Week Sleep Restriction, 6h/Night (Moller-Levet 2013)'
          };
        }
        if (filename === 'GSE48113_ForcedDesync_Aligned_circadian.csv') {
          return {
            id: filename.replace('.csv', ''),
            filename,
            study: 'GSE48113',
            type: 'human',
            tissue: 'Human Blood',
            condition: 'Aligned Sleep',
            description: 'Human Blood - Forced Desynchrony, Sleep Aligned with Melatonin (Archer 2014)'
          };
        }
        if (filename === 'GSE48113_ForcedDesync_Misaligned_circadian.csv') {
          return {
            id: filename.replace('.csv', ''),
            filename,
            study: 'GSE48113',
            type: 'human',
            tissue: 'Human Blood',
            condition: 'Misaligned Sleep',
            description: 'Human Blood - Forced Desynchrony, Sleep Misaligned with Melatonin (Archer 2014)'
          };
        }
        if (filename === 'GSE205155_Skin_Dermis_circadian.csv') {
          return {
            id: filename.replace('.csv', ''),
            filename,
            study: 'GSE205155',
            type: 'human',
            tissue: 'Human Skin Dermis',
            condition: 'Circadian',
            description: 'Human Skin Dermis - Circadian Expression (del Olmo 2022)'
          };
        }
        if (filename === 'GSE205155_Skin_Epidermis_circadian.csv') {
          return {
            id: filename.replace('.csv', ''),
            filename,
            study: 'GSE205155',
            type: 'human',
            tissue: 'Human Skin Epidermis',
            condition: 'Circadian',
            description: 'Human Skin Epidermis - Circadian Expression (del Olmo 2022)'
          };
        }
        if (filename === 'GSE70499_Liver_Bmal1WT_circadian.csv') {
          return {
            id: filename.replace('.csv', ''),
            filename,
            study: 'GSE70499',
            type: 'tissue',
            tissue: 'Mouse Liver',
            condition: 'Bmal1 Wild-Type',
            description: 'Mouse Liver - Wild-Type Control for Bmal1-KO (Yang 2016)'
          };
        }
        if (filename === 'GSE70499_Liver_Bmal1KO_circadian.csv') {
          return {
            id: filename.replace('.csv', ''),
            filename,
            study: 'GSE70499',
            type: 'tissue',
            tissue: 'Mouse Liver',
            condition: 'Bmal1 Knockout',
            description: 'Mouse Liver - Bmal1-Knockout, Master Clock Ablation (Yang 2016)'
          };
        }
        if (filename === 'GSE93903_Liver_Young_circadian.csv') {
          return {
            id: filename.replace('.csv', ''),
            filename,
            study: 'GSE93903',
            type: 'aging',
            tissue: 'Mouse Liver',
            condition: 'Young',
            description: 'Mouse Liver - Young Animals, Ad Libitum (Sato 2017)'
          };
        }
        if (filename === 'GSE93903_Liver_Old_circadian.csv') {
          return {
            id: filename.replace('.csv', ''),
            filename,
            study: 'GSE93903',
            type: 'aging',
            tissue: 'Mouse Liver',
            condition: 'Old',
            description: 'Mouse Liver - Old Animals, Ad Libitum (Sato 2017)'
          };
        }
        if (filename === 'GSE93903_Liver_YoungCR_circadian.csv') {
          return {
            id: filename.replace('.csv', ''),
            filename,
            study: 'GSE93903',
            type: 'aging',
            tissue: 'Mouse Liver',
            condition: 'Young + Caloric Restriction',
            description: 'Mouse Liver - Young Animals, Caloric Restriction (Sato 2017)'
          };
        }
        if (filename === 'GSE93903_Liver_OldCR_circadian.csv') {
          return {
            id: filename.replace('.csv', ''),
            filename,
            study: 'GSE93903',
            type: 'aging',
            tissue: 'Mouse Liver',
            condition: 'Old + Caloric Restriction',
            description: 'Mouse Liver - Old Animals, Caloric Restriction (Sato 2017)'
          };
        }
        if (filename === 'GSE133342_Liver_ConstantDarkness_refseq.csv') {
          return {
            id: filename.replace('.csv', ''),
            filename,
            study: 'GSE133342',
            type: 'tissue',
            tissue: 'Mouse Liver',
            condition: 'Constant Darkness (RefSeq)',
            description: 'Mouse Liver - Constant Darkness, RefSeq IDs (Chen 2020)'
          };
        }
        if (filename === 'GSE201207_cpm.csv') {
          return {
            id: filename.replace('.csv', ''),
            filename,
            study: 'GSE201207',
            type: 'aging',
            tissue: 'Mouse Kidney',
            condition: 'Full CPM Matrix',
            description: 'Mouse Kidney Aging - Full CPM Expression Matrix'
          };
        }
        if (filename === 'GSE245295_aging_pancreas.csv') {
          return {
            id: filename.replace('.csv', ''),
            filename,
            study: 'GSE245295',
            type: 'aging',
            tissue: 'Mouse Pancreas',
            condition: 'Aging',
            description: 'Mouse Pancreas - Aging Time Series (Pancreatic Islets)'
          };
        }
        if (filename === 'GSE245295_metadata.csv') {
          return {
            id: filename.replace('.csv', ''),
            filename,
            study: 'GSE245295',
            type: 'metadata',
            tissue: 'Mouse Pancreas',
            condition: 'Metadata',
            description: 'Mouse Pancreas Aging - Sample Metadata'
          };
        }
        if (filename === 'GSE233242_Processed_file_tpm.csv') {
          return {
            id: filename.replace('.csv', ''),
            filename,
            study: 'GSE233242',
            type: 'tissue',
            tissue: 'Expression Data',
            condition: 'TPM',
            description: 'Processed TPM Expression Matrix (GSE233242)'
          };
        }
        if (filename === 'GSE233242_Sample_ID_to_GEO_ids.csv') {
          return {
            id: filename.replace('.csv', ''),
            filename,
            study: 'GSE233242',
            type: 'metadata',
            tissue: 'Expression Data',
            condition: 'Sample Mapping',
            description: 'Sample ID to GEO ID Mapping (GSE233242)'
          };
        }
        if (filename === 'GSE3431_yeast_metabolic_cycle.csv') {
          return {
            id: filename.replace('.csv', ''),
            filename,
            study: 'GSE3431',
            type: 'yeast',
            tissue: 'Yeast (S. cerevisiae)',
            condition: 'Metabolic Cycle',
            description: 'Yeast Metabolic Cycle - Oscillating Culture (Tu 2005)'
          };
        }
        if (filename === 'GSE48113_Human_Blood_PAR2_Results.csv') {
          return {
            id: filename.replace('.csv', ''),
            filename,
            study: 'GSE48113',
            type: 'human',
            tissue: 'Human Blood',
            condition: 'PAR2 Results',
            description: 'Human Blood - Pre-Computed PAR(2) Results (Archer 2014)'
          };
        }
        if (filename === 'GSE59396_Lung_Basal.csv') {
          return {
            id: filename.replace('.csv', ''),
            filename,
            study: 'GSE59396',
            type: 'inflammation',
            tissue: 'Mouse Lung',
            condition: 'Basal',
            description: 'Mouse Lung - Healthy Baseline (Haspel 2014)'
          };
        }
        if (filename === 'GSE67305_Liver_RibosomeFootprint_circadian.csv') {
          return {
            id: filename.replace('.csv', ''),
            filename,
            study: 'GSE67305',
            type: 'tissue',
            tissue: 'Mouse Liver',
            condition: 'Ribosome Footprint',
            description: 'Mouse Liver - Ribosome Profiling Translatome (Janich/Gatfield 2015)'
          };
        }
        if (filename === 'GSE67305_Liver_TotalRNA_circadian.csv') {
          return {
            id: filename.replace('.csv', ''),
            filename,
            study: 'GSE67305',
            type: 'tissue',
            tissue: 'Mouse Liver',
            condition: 'Total RNA',
            description: 'Mouse Liver - Total RNA Transcriptome (Janich/Gatfield 2015)'
          };
        }
        if (filename === 'GSE98965_Baboon_BoneMarrow_circadian.csv') {
          return {
            id: filename.replace('.csv', ''),
            filename,
            study: 'GSE98965',
            type: 'primate',
            tissue: 'Baboon Bone Marrow',
            condition: 'Diurnal',
            description: 'Baboon Bone Marrow - Diurnal Transcriptome (Mure 2018)'
          };
        }
        if (filename === 'GSE98965_Baboon_Heart_circadian.csv') {
          return {
            id: filename.replace('.csv', ''),
            filename,
            study: 'GSE98965',
            type: 'primate',
            tissue: 'Baboon Heart',
            condition: 'Diurnal',
            description: 'Baboon Heart - Diurnal Transcriptome (Mure 2018)'
          };
        }
        if (filename === 'GSE98965_Baboon_KidneyCortex_circadian.csv') {
          return {
            id: filename.replace('.csv', ''),
            filename,
            study: 'GSE98965',
            type: 'primate',
            tissue: 'Baboon Kidney Cortex',
            condition: 'Diurnal',
            description: 'Baboon Kidney Cortex - Diurnal Transcriptome (Mure 2018)'
          };
        }
        if (filename === 'GSE98965_Baboon_Liver_circadian.csv') {
          return {
            id: filename.replace('.csv', ''),
            filename,
            study: 'GSE98965',
            type: 'primate',
            tissue: 'Baboon Liver',
            condition: 'Diurnal',
            description: 'Baboon Liver - Diurnal Transcriptome (Mure 2018)'
          };
        }
        if (filename === 'GSE98965_Baboon_Lung_circadian.csv') {
          return {
            id: filename.replace('.csv', ''),
            filename,
            study: 'GSE98965',
            type: 'primate',
            tissue: 'Baboon Lung',
            condition: 'Diurnal',
            description: 'Baboon Lung - Diurnal Transcriptome (Mure 2018)'
          };
        }
        if (filename === 'GSE98965_Baboon_SCN_circadian.csv') {
          return {
            id: filename.replace('.csv', ''),
            filename,
            study: 'GSE98965',
            type: 'primate',
            tissue: 'Baboon SCN',
            condition: 'Diurnal',
            description: 'Baboon Suprachiasmatic Nucleus - Diurnal Transcriptome (Mure 2018)'
          };
        }

        // ── Datasets added to the discovery engine sample panel ──────────────

        if (filename === 'GSE108539_Human_SkeletalMuscle_Circadian.csv') {
          return { id: filename.replace('.csv', ''), filename, study: 'GSE108539', type: 'human', tissue: 'Human Skeletal Muscle', condition: 'Circadian', description: 'Human Skeletal Muscle - Circadian Expression (Perrin 2018)' };
        }
        // GSE161566 with underscore variant (Human_Enteroid vs HumanEnteroid)
        if (filename === 'GSE161566_Human_Enteroid_circadian.csv') {
          return { id: filename.replace('.csv', ''), filename, study: 'GSE161566', type: 'enteroid', tissue: 'Human Intestinal Enteroid', condition: 'Wild-type', description: 'Human Intestinal Enteroid - Circadian, 24 Timepoints (Rosselot 2022)' };
        }
        // GSE179027 with underscore variant (Mouse_Enteroid vs MouseEnteroid)
        if (filename === 'GSE179027_Mouse_Enteroid_circadian.csv') {
          return { id: filename.replace('.csv', ''), filename, study: 'GSE179027', type: 'enteroid', tissue: 'Mouse Intestinal Enteroid', condition: 'Wild-type', description: 'Mouse Intestinal Enteroid - Circadian, 24 Timepoints (Rosselot 2022)' };
        }
        if (filename === 'GSE19271_Arabidopsis_WT_ConstantLight.csv') {
          return { id: filename.replace('.csv', ''), filename, study: 'GSE19271', type: 'plant', tissue: 'Arabidopsis thaliana', condition: 'WT — Constant Light', description: 'Arabidopsis thaliana - Wild-Type, Constant Light (Covington 2008)' };
        }
        if (filename === 'GSE37278_Arabidopsis_WT_ConstantLight.csv') {
          return { id: filename.replace('.csv', ''), filename, study: 'GSE37278', type: 'plant', tissue: 'Arabidopsis thaliana', condition: 'WT — Constant Light', description: 'Arabidopsis thaliana - Wild-Type, Constant Light (Michael 2008)' };
        }
        if (filename === 'GSE232040_GBM_ZmanSeq_expression_per_timebin.csv') {
          return { id: filename.replace('.csv', ''), filename, study: 'GSE232040', type: 'cancer', tissue: 'GBM (Human)', condition: 'Zman-seq Time-bins', description: 'Glioblastoma Multiforme - Zman-seq Single-Cell Temporal Profiling (Shen 2023)' };
        }
        if (filename === 'GSE24416_Pfalciparum_IDC_processed.csv') {
          return { id: filename.replace('.csv', ''), filename, study: 'GSE24416', type: 'parasite', tissue: 'P. falciparum', condition: 'Intraerythrocytic Dev.', description: 'Plasmodium falciparum - Intraerythrocytic Development Cycle (Llinas 2006)' };
        }
        if (filename === 'GSE25585_macrophage_circadian.csv') {
          return { id: filename.replace('.csv', ''), filename, study: 'GSE25585', type: 'immune', tissue: 'Mouse Macrophage', condition: 'Circadian', description: 'Mouse Peritoneal Macrophage - Circadian Transcriptome (Keller 2009)' };
        }
        if (filename === 'GSE3830_Drosophila_LDDD_processed.csv') {
          return { id: filename.replace('.csv', ''), filename, study: 'GSE3830', type: 'insect', tissue: 'Drosophila (whole fly)', condition: 'LD → DD transition', description: 'Drosophila melanogaster - LD to DD Entrainment Transition (Ceriani 2002)' };
        }
        if (filename === 'GSE6491_Drosophila_AA_processed.csv') {
          return { id: filename.replace('.csv', ''), filename, study: 'GSE6491', type: 'insect', tissue: 'Drosophila (whole fly)', condition: 'Arrhythmic (AA)', description: 'Drosophila melanogaster - Arrhythmic Allele, per01 (Claridge-Chang 2001)' };
        }
        if (filename === 'GSE6491_Drosophila_CA_processed.csv') {
          return { id: filename.replace('.csv', ''), filename, study: 'GSE6491', type: 'insect', tissue: 'Drosophila (whole fly)', condition: 'Cycling (CA)', description: 'Drosophila melanogaster - Wild-type Cycling (Claridge-Chang 2001)' };
        }
        if (filename === 'GSE56931_Human_Blood_SleepDep_Baseline.csv') {
          return { id: filename.replace('.csv', ''), filename, study: 'GSE56931', type: 'human', tissue: 'Human Blood', condition: 'Sleep-Dep Baseline', description: 'Human Blood - Baseline before Total Sleep Deprivation (Möller-Levet 2013)' };
        }
        if (filename === 'GSE98965_baboon_liver_only.csv') {
          return { id: filename.replace('.csv', ''), filename, study: 'GSE98965', type: 'primate', tissue: 'Baboon Liver', condition: 'FPKM (liver-only)', description: 'Baboon Liver - FPKM Subset of Multi-tissue Atlas (Mure 2018)' };
        }
        // Non-GSE files added to the scan (Arbeitman, Amit)
        if (filename === 'Arbeitman2002_DrosophilaEmbryo.csv') {
          return { id: filename.replace('.csv', ''), filename, study: 'Arbeitman 2002', type: 'insect', tissue: 'Drosophila Embryo', condition: 'Development', description: 'Drosophila melanogaster - Full Developmental Time Series (Arbeitman 2002, Science)' };
        }
        if (filename === 'Amit2009_DC_LPS_TimeCourse.csv') {
          return { id: filename.replace('.csv', ''), filename, study: 'Amit 2009', type: 'immune', tissue: 'Mouse Dendritic Cell', condition: 'LPS Time Course', description: 'Mouse Dendritic Cell - LPS Stimulation Time Course (Amit 2009, Science)' };
        }
        if (filename === 'Zaas2009_InfluenzaH3N2_Human.csv') {
          return { id: filename.replace('.csv', ''), filename, study: 'Zaas 2009', type: 'human', tissue: 'Human Blood', condition: 'Influenza H3N2', description: 'Human Blood - Influenza H3N2 Infection Time Course (Zaas 2009, Cell Host Microbe)' };
        }

        return { id: filename.replace('.csv', ''), filename, study: 'Unknown', type: 'unknown', tissue: 'Unknown', condition: null, description: filename };
      });
      
      // Sort: tissues first, then organoids, then specialized studies
      const typeOrder: Record<string, number> = {
        'tissue': 0,
        'organoid': 1,
        'human': 2,
        'primate': 3,
        'cancer': 4,
        'neurodegeneration': 5,
        'kidney': 6,
        'aging': 7,
        'inflammation': 8,
        'plant': 9,
        'yeast': 10,
        'proteomics': 11,
        'metabolomics': 12,
        'metadata': 13,
        'unknown': 14
      };
      datasets.sort((a, b) => {
        const orderA = typeOrder[a.type] ?? 5;
        const orderB = typeOrder[b.type] ?? 5;
        if (orderA !== orderB) return orderA - orderB;
        return a.description.localeCompare(b.description);
      });
      
      res.json(datasets);
    } catch (error) {
      console.error("Error listing embedded datasets:", error);
      res.status(500).json({ error: "Failed to list embedded datasets" });
    }
  });

  // Helper to find gene data by either Ensembl ID or gene symbol
  // Uses the gene mapping from PAR2 engine for Ensembl ID resolution
  const findGeneData = (parsed: ParsedDataset, gene: { id: string; name: string }) => {
    // First try direct matches
    const directMatch = parsed.geneTimeSeries.get(gene.id) || parsed.geneTimeSeries.get(gene.name);
    if (directMatch) return directMatch;
    
    // Try using the centralized gene name resolution (handles Ensembl ID mapping)
    const availableGenes = parsed.geneIds;
    const resolvedName = resolveGeneName(gene.name, availableGenes);
    if (resolvedName) {
      return parsed.geneTimeSeries.get(resolvedName);
    }
    
    // Also try case-insensitive match on gene symbol
    const lowerName = gene.name.toLowerCase();
    for (const geneId of availableGenes) {
      if (geneId.toLowerCase() === lowerName) {
        return parsed.geneTimeSeries.get(geneId);
      }
    }
    
    return undefined;
  };

  // Load an embedded dataset for analysis
  app.get("/api/datasets/embedded/:id", async (req, res) => {
    try {
      const filename = sanitizePathParam(req.params.id) + '.csv';
      const filepath = path.join(process.cwd(), 'datasets', filename);
      
      if (!fs.existsSync(filepath)) {
        return res.status(404).json({ error: "Dataset not found" });
      }
      
      const buffer = fs.readFileSync(filepath);
      const parsed = await parseDatasetBuffer(buffer, filename);
      
      // Create preview data - check both ID and name for gene matching
      const previewData = parsed.timepoints.slice(0, 30).map((t, i) => {
        const row: Record<string, number> = { time: t };
        [...CANDIDATES, ...CLOCKS].forEach(gene => {
          const values = findGeneData(parsed, gene);
          if (values && values[i] !== undefined) {
            row[gene.name] = values[i];
          }
        });
        return row;
      });

      const availableGenes = [...CANDIDATES, ...CLOCKS]
        .filter(gene => findGeneData(parsed, gene) !== undefined)
        .map(gene => gene.name);

      res.json({
        fileName: filename,
        rowCount: parsed.timepoints.length,
        geneCount: parsed.geneIds.length,
        timepoints: parsed.timepoints.slice(0, 10),
        availableGenes,
        previewData,
        format: parsed.format
      });
    } catch (error) {
      console.error("Error loading embedded dataset:", error);
      res.status(500).json({ error: `Failed to load dataset: ${error}` });
    }
  });

  // Run PAR(2) synthetic data validation suite (password protected - reveals test logic)
  app.get("/api/validation/synthetic", async (req, res) => {
    const auth = verifyDownloadPassword(req);
    if (!auth.valid) {
      return res.status(401).json({ error: auth.error });
    }
    
    try {
      logger.info("Running PAR(2) synthetic data validation suite");
      const results = runValidationSuite();
      
      logger.info("Validation complete", {
        passed: results.summary.passed,
        failed: results.summary.failed,
        passRate: `${(results.summary.passRate * 100).toFixed(1)}%`
      });
      
      res.json({
        success: results.summary.passRate >= 0.8,
        summary: results.summary,
        positiveControls: results.positiveControls.map(r => ({
          config: r.config,
          pValue: r.par2Result.pValue,
          pValueCorrected: r.par2Result.pValueCorrected,
          significant: r.par2Result.significant,
          passed: r.passed,
          details: r.details
        })),
        negativeControls: results.negativeControls.map(r => ({
          config: r.config,
          pValue: r.par2Result.pValue,
          pValueCorrected: r.par2Result.pValueCorrected,
          significant: r.par2Result.significant,
          passed: r.passed,
          details: r.details
        }))
      });
    } catch (error) {
      console.error("Validation error:", error);
      res.status(500).json({ error: "Validation failed", details: String(error) });
    }
  });

  // TIER 0: Ultimate Confidence Analysis Results
  app.get("/api/tier0/results", async (req, res) => {
    try {
      const tier0Path = path.join(process.cwd(), 'TIER0_ULTIMATE_CONFIDENCE.json');
      
      if (!fs.existsSync(tier0Path)) {
        return res.status(404).json({ 
          error: 'TIER 0 analysis not yet run',
          message: 'Run the TIER 0 analysis script first: npx tsx scripts/tier0-ultimate-confidence.ts'
        });
      }
      
      const tier0Data = JSON.parse(fs.readFileSync(tier0Path, 'utf-8'));
      res.json(tier0Data);
    } catch (error) {
      console.error("Error loading TIER 0 results:", error);
      res.status(500).json({ error: "Failed to load TIER 0 results" });
    }
  });

  // Serve TIER 0 report file directly
  app.get("/TIER0_ULTIMATE_CONFIDENCE.txt", async (req, res) => {
    try {
      const reportPath = path.join(process.cwd(), 'TIER0_ULTIMATE_CONFIDENCE.txt');
      
      if (!fs.existsSync(reportPath)) {
        return res.status(404).send('TIER 0 report not yet generated');
      }
      
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename=TIER0_ULTIMATE_CONFIDENCE.txt');
      res.send(fs.readFileSync(reportPath, 'utf-8'));
    } catch (error) {
      console.error("Error serving TIER 0 report:", error);
      res.status(500).send('Failed to serve TIER 0 report');
    }
  });

  // AR(2) Eigenvalue Analysis - Stability, Eigenperiod, and Golden Ratio
  app.get("/api/eigenvalue/analyze", async (req, res) => {
    try {
      const { beta1, beta2, samplingInterval } = req.query;
      
      if (!beta1 || !beta2) {
        return res.status(400).json({ 
          error: "Missing required parameters",
          usage: "GET /api/eigenvalue/analyze?beta1=0.5&beta2=0.2&samplingInterval=2"
        });
      }
      
      const b1 = parseFloat(beta1 as string);
      const b2 = parseFloat(beta2 as string);
      const interval = samplingInterval ? parseFloat(samplingInterval as string) : 2;
      
      if (isNaN(b1) || isNaN(b2)) {
        return res.status(400).json({ error: "beta1 and beta2 must be valid numbers" });
      }
      
      const { generateStabilityReport, formatStabilityReportText } = await import('../par2-engine');
      const report = generateStabilityReport(b1, b2, undefined, undefined, interval);
      const textReport = formatStabilityReportText(report);
      
      res.json({
        success: true,
        report,
        textReport
      });
    } catch (error) {
      console.error("Eigenvalue analysis error:", error);
      res.status(500).json({ error: "Eigenvalue analysis failed", details: String(error) });
    }
  });

  // Get eigenvalue analysis for a specific analysis run (averages across all pairs)
  app.get("/api/analyses/:runId/eigenvalue", async (req, res) => {
    try {
      const { runId } = req.params;
      const hypotheses = await storage.getHypothesesByRunId(runId);
      
      if (!hypotheses || hypotheses.length === 0) {
        return res.status(404).json({ error: "No hypotheses found for this run" });
      }
      
      const { generateStabilityReport, formatStabilityReportText } = await import('../par2-engine');
      
      // Extract coefficients from confidenceIntervals JSONB field
      const validCoeffs = hypotheses.filter(h => {
        const ci = h.confidenceIntervals as any;
        return ci && 
          typeof ci.R_n_1?.coefficient === 'number' &&
          typeof ci.R_n_2?.coefficient === 'number';
      });
      
      if (validCoeffs.length === 0) {
        return res.status(400).json({ 
          error: "No coefficient data available for eigenvalue analysis",
          hint: "Re-run analysis with detailed coefficient output"
        });
      }
      
      // Compute per-pair eigenvalue analyses
      const perPairAnalyses = validCoeffs.map(h => {
        const ci = h.confidenceIntervals as any;
        const beta1 = ci.R_n_1.coefficient;
        const beta2 = ci.R_n_2.coefficient;
        return {
          targetGene: h.targetGene,
          clockGene: h.clockGene,
          beta1,
          beta2,
          report: generateStabilityReport(beta1, beta2)
        };
      });
      
      // Compute average coefficients for summary report
      const avgBeta1 = validCoeffs.reduce((sum, h) => {
        const ci = h.confidenceIntervals as any;
        return sum + (ci.R_n_1?.coefficient || 0);
      }, 0) / validCoeffs.length;
      
      const avgBeta2 = validCoeffs.reduce((sum, h) => {
        const ci = h.confidenceIntervals as any;
        return sum + (ci.R_n_2?.coefficient || 0);
      }, 0) / validCoeffs.length;
      
      const summaryReport = generateStabilityReport(avgBeta1, avgBeta2);
      const textReport = formatStabilityReportText(summaryReport);
      
      // Compute statistics across pairs
      const eigenperiods = perPairAnalyses
        .map(p => p.report.eigenperiod.emergentCycleHours)
        .filter((e): e is number => e !== null);
      
      const fibonacciScores = perPairAnalyses.map(p => p.report.goldenRatio.fibonacciSimilarity);
      const stablePairs = perPairAnalyses.filter(p => p.report.stability.isStable).length;
      
      res.json({
        success: true,
        runId,
        pairsAnalyzed: validCoeffs.length,
        summary: {
          averageCoefficients: { beta1: avgBeta1, beta2: avgBeta2 },
          report: summaryReport,
          textReport
        },
        statistics: {
          stablePairs,
          unstablePairs: validCoeffs.length - stablePairs,
          meanEigenperiod: eigenperiods.length > 0 ? eigenperiods.reduce((a, b) => a + b, 0) / eigenperiods.length : null,
          eigenperiodRange: eigenperiods.length > 0 ? { min: eigenperiods.reduce((m, v) => v < m ? v : m, Infinity), max: eigenperiods.reduce((m, v) => v > m ? v : m, -Infinity) } : null,
          meanBandProximity: fibonacciScores.reduce((a, b) => a + b, 0) / fibonacciScores.length,
          inStabilityBandCount: perPairAnalyses.filter(p => p.report.goldenRatio.isFibonacciLike).length
        },
        perPairAnalyses: perPairAnalyses.slice(0, 20) // Return first 20 for brevity
      });
    } catch (error) {
      console.error("Eigenvalue analysis error:", error);
      res.status(500).json({ error: "Eigenvalue analysis failed", details: String(error) });
    }
  });

  // Download stability report as text file
  app.get("/api/download/stability-report", async (req, res) => {
    try {
      const { beta1, beta2, samplingInterval } = req.query;
      
      if (!beta1 || !beta2) {
        return res.status(400).json({ 
          error: "Missing required parameters",
          usage: "GET /api/download/stability-report?beta1=0.5&beta2=0.2"
        });
      }
      
      const b1 = parseFloat(beta1 as string);
      const b2 = parseFloat(beta2 as string);
      const interval = samplingInterval ? parseFloat(samplingInterval as string) : 2;
      
      const { generateStabilityReport, formatStabilityReportText } = await import('../par2-engine');
      const report = generateStabilityReport(b1, b2, undefined, undefined, interval);
      const textReport = formatStabilityReportText(report);
      
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="stability_report_b1_${b1}_b2_${b2}.txt"`);
      res.send(textReport);
    } catch (error) {
      console.error("Stability report download error:", error);
      res.status(500).json({ error: "Failed to generate stability report" });
    }
  });

  // Check gene availability in a dataset before analysis
  app.post("/api/datasets/check-genes", upload.single("file"), async (req: Request, res) => {
    try {
      const file = req.file;
      const { genes, datasetId } = req.body;
      
      let parsed;
      if (file) {
        parsed = await parseDatasetBuffer(file.buffer, file.originalname);
      } else if (datasetId) {
        const filename = datasetId + '.csv';
        const filepath = path.join(process.cwd(), 'datasets', filename);
        if (!fs.existsSync(filepath)) {
          return res.status(404).json({ error: "Dataset not found" });
        }
        const buffer = fs.readFileSync(filepath);
        parsed = await parseDatasetBuffer(buffer, filename);
      } else {
        return res.status(400).json({ error: "No file or datasetId provided" });
      }
      
      // Parse requested genes
      const requestedGenes: string[] = genes ? JSON.parse(genes) : 
        [...CANDIDATES, ...CLOCKS].map(g => g.name);
      
      // Check availability
      const availability = checkGeneAvailability(requestedGenes, parsed.geneIds);
      
      // Add display names for found genes
      const results = availability.results.map(r => ({
        ...r,
        displayName: r.resolvedAs ? getDisplayName(r.resolvedAs) : r.gene
      }));
      
      res.json({
        datasetInfo: {
          geneCount: parsed.geneIds.length,
          timepointCount: parsed.timepoints.length,
          format: parsed.format
        },
        geneAvailability: {
          allAvailable: availability.allAvailable,
          checkedCount: requestedGenes.length,
          availableCount: requestedGenes.length - availability.missing.length,
          missingCount: availability.missing.length,
          missing: availability.missing
        },
        genes: results
      });
    } catch (error) {
      console.error("Error checking gene availability:", error);
      res.status(500).json({ error: `Failed to check genes: ${error}` });
    }
  });

  // Get raw embedded dataset file
  app.get("/api/datasets/embedded/:id/raw", async (req, res) => {
    try {
      const filename = sanitizePathParam(req.params.id) + '.csv';
      const filepath = path.join(process.cwd(), 'datasets', filename);
      
      if (!fs.existsSync(filepath)) {
        return res.status(404).json({ error: "Dataset not found" });
      }
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      fs.createReadStream(filepath).pipe(res);
    } catch (error) {
      console.error("Error downloading embedded dataset:", error);
      res.status(500).json({ error: `Failed to download dataset: ${error}` });
    }
  });

  // Preview uploaded dataset
  app.post("/api/datasets/preview", upload.single("file"), async (req: Request, res) => {
    try {
      const file = req.file;
      if (!file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const parsed = await parseDatasetBuffer(file.buffer, file.originalname);
      
      // Create preview data for charting
      const previewData = parsed.timepoints.slice(0, 30).map((t, i) => {
        const row: Record<string, number> = { time: t };
        
        // Add known genes with friendly names - check both ID and name
        [...CANDIDATES, ...CLOCKS].forEach(gene => {
          const values = findGeneData(parsed, gene);
          if (values && values[i] !== undefined) {
            row[gene.name] = values[i];
          }
        });
        
        // If no known genes found, show first few from file
        if (Object.keys(row).length <= 1) {
          let count = 0;
          const entries = Array.from(parsed.geneTimeSeries.entries());
          for (const [geneId, values] of entries) {
            if (count >= 4) break;
            if (values[i] !== undefined) {
              const shortName = geneId.length > 15 ? geneId.slice(0, 15) : geneId;
              row[shortName] = values[i];
              count++;
            }
          }
        }
        
        return row;
      });

      // Check which of our target genes are available - check both ID and name
      const availableGenes = [...CANDIDATES, ...CLOCKS]
        .filter(gene => findGeneData(parsed, gene) !== undefined)
        .map(gene => gene.name);

      res.json({
        fileName: file.originalname,
        rowCount: parsed.timepoints.length,
        geneCount: parsed.geneIds.length,
        timepoints: parsed.timepoints.slice(0, 10),
        availableGenes,
        previewData,
        format: parsed.format
      });
    } catch (error) {
      console.error("Error previewing dataset:", error);
      res.status(500).json({ error: `Failed to parse dataset: ${error}` });
    }
  });

  // Data quality assessment endpoint
  app.post("/api/datasets/quality-check", upload.single("file"), async (req: Request, res) => {
    try {
      const file = req.file;
      if (!file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const parsed = await parseDatasetBuffer(file.buffer, file.originalname);
      
      // Run comprehensive data quality assessment
      const qualityReport = assessDataQuality(parsed.geneTimeSeries, parsed.timepoints);
      
      logger.info('Data quality assessment completed', {
        filename: file.originalname,
        score: qualityReport.overallScore,
        canProceed: qualityReport.canProceed,
        warningCount: qualityReport.warnings.length
      });

      res.json({
        filename: file.originalname,
        ...qualityReport,
        summary: {
          nTimepoints: qualityReport.metrics.nTimepoints,
          nGenes: qualityReport.metrics.nGenes,
          estimatedDataType: qualityReport.metrics.estimatedDataType,
          clockGenesFound: qualityReport.metrics.clockGenesFound.length,
          clockGenesMissing: qualityReport.metrics.clockGenesMissing.length,
          targetGenesFound: qualityReport.metrics.targetGenesFound.length
        }
      });
    } catch (error) {
      console.error("Error checking data quality:", error);
      res.status(500).json({ error: `Failed to assess data quality: ${error}` });
    }
  });

  // Comprehensive Stability Band Analysis with Full Workings
  // Note: Endpoint uses historical path name for backwards compatibility; analysis uses stability band terminology
  app.post("/api/analyses/fibonacci-comprehensive", upload.single("dataset"), async (req: Request, res) => {
    try {
      const { datasetName } = req.body;
      
      let parsedData: ParsedDataset;
      let actualDatasetName = datasetName || (req.file ? req.file.originalname : 'unknown');
      
      if (req.file) {
        parsedData = await parseDatasetBuffer(req.file.buffer, req.file.originalname);
      } else if (datasetName) {
        const safeDatasetName = sanitizePathParam(datasetName);
        const embeddedPath = path.join(process.cwd(), 'datasets', safeDatasetName);
        if (fs.existsSync(embeddedPath)) {
          const buffer = fs.readFileSync(embeddedPath);
          parsedData = await parseDatasetBuffer(buffer, safeDatasetName);
        } else {
          return res.status(400).json({ error: "Dataset not found" });
        }
      } else {
        return res.status(400).json({ error: "No dataset provided" });
      }
      
      const GOLDEN_RATIO = 1.6180339887;
      const clockGenes = ['Per2', 'Arntl', 'Clock', 'Per1', 'Cry1', 'Cry2', 'Nr1d1', 'Nr1d2', 'Per3', 'Dbp', 'Tef', 'Npas2', 'Rorc'];
      const targetGenes = ['Myc', 'Ccnd1', 'Wee1', 'Chek2', 'Lgr5', 'Axin2', 'Tp53', 'Cdkn1a', 'Bcl2', 'Bax', 'Ccne1', 'Ccne2', 'Mcm6', 'Mki67'];
      
      const geneIds = Array.from(parsedData.geneTimeSeries.keys());
      const results: any[] = [];
      
      // Sort timepoints
      const timeIndices = parsedData.timepoints.map((t, i) => ({ time: t, index: i }));
      timeIndices.sort((a, b) => a.time - b.time);
      const sortedTimepoints = timeIndices.map(x => x.time);
      
      for (const clockName of clockGenes) {
        const clockResolved = resolveGeneName(clockName, geneIds);
        if (!clockResolved) continue;
        
        const clockRaw = parsedData.geneTimeSeries.get(clockResolved);
        if (!clockRaw) continue;
        
        const clockExpr = timeIndices.map(x => clockRaw[x.index]);
        
        for (const targetName of targetGenes) {
          const targetResolved = resolveGeneName(targetName, geneIds);
          if (!targetResolved || targetResolved === clockResolved) continue;
          
          const targetRaw = parsedData.geneTimeSeries.get(targetResolved);
          if (!targetRaw) continue;
          
          const targetExpr = timeIndices.map(x => targetRaw[x.index]);
          
          // Skip if insufficient data
          if (targetExpr.length < 6) continue;
          
          const n = targetExpr.length;
          
          // ============================================================
          // PHASE-GATED ARX MODEL (PAR(2) with driver gene coupling)
          // Paper model: xt = φ₁(θt)·xt-1 + φ₂(θt)·xt-2 + γ·C(t) + εt
          // Where θt is the clock gene's phase, C(t) is clock expression
          // ============================================================
          
          // Step 1: Extract clock gene phase via 3-parameter cosine least-squares fit
          // Model: C(t) = A·cos(ωt) + B·sin(ωt) + M, then φ = atan2(-B, A)
          // This is a proper regression that handles irregular sampling correctly
          
          // Smart period estimation: try candidate periods and pick best fit
          const timeRange = sortedTimepoints[sortedTimepoints.length - 1] - sortedTimepoints[0];
          const candidatePeriods = timeRange > 20 ? [24, 23, 25, 22, 26] : [timeRange, timeRange * 0.9, timeRange * 1.1];
          
          let bestPeriod = 24;
          let bestR2 = -Infinity;
          
          for (const period of candidatePeriods) {
            const omega_test = 2 * Math.PI / period;
            
            // Build design matrix: [1, cos(ωt), sin(ωt)]
            let XtX_test = [[0,0,0],[0,0,0],[0,0,0]];
            let XtY_test = [0,0,0];
            
            for (let i = 0; i < n; i++) {
              const t = sortedTimepoints[i];
              const cosT = Math.cos(omega_test * t);
              const sinT = Math.sin(omega_test * t);
              const row = [1, cosT, sinT];
              for (let j = 0; j < 3; j++) {
                XtY_test[j] += row[j] * clockExpr[i];
                for (let k = 0; k < 3; k++) {
                  XtX_test[j][k] += row[j] * row[k];
                }
              }
            }
            
            // Solve 3x3 system via Cramer's rule
            const det = XtX_test[0][0]*(XtX_test[1][1]*XtX_test[2][2]-XtX_test[1][2]*XtX_test[2][1]) 
                      - XtX_test[0][1]*(XtX_test[1][0]*XtX_test[2][2]-XtX_test[1][2]*XtX_test[2][0]) 
                      + XtX_test[0][2]*(XtX_test[1][0]*XtX_test[2][1]-XtX_test[1][1]*XtX_test[2][0]);
            
            if (Math.abs(det) > 1e-10) {
              const invXtX = [
                [(XtX_test[1][1]*XtX_test[2][2]-XtX_test[1][2]*XtX_test[2][1])/det, (XtX_test[0][2]*XtX_test[2][1]-XtX_test[0][1]*XtX_test[2][2])/det, (XtX_test[0][1]*XtX_test[1][2]-XtX_test[0][2]*XtX_test[1][1])/det],
                [(XtX_test[1][2]*XtX_test[2][0]-XtX_test[1][0]*XtX_test[2][2])/det, (XtX_test[0][0]*XtX_test[2][2]-XtX_test[0][2]*XtX_test[2][0])/det, (XtX_test[0][2]*XtX_test[1][0]-XtX_test[0][0]*XtX_test[1][2])/det],
                [(XtX_test[1][0]*XtX_test[2][1]-XtX_test[1][1]*XtX_test[2][0])/det, (XtX_test[0][1]*XtX_test[2][0]-XtX_test[0][0]*XtX_test[2][1])/det, (XtX_test[0][0]*XtX_test[1][1]-XtX_test[0][1]*XtX_test[1][0])/det]
              ];
              const beta_test = [0,0,0];
              for (let j = 0; j < 3; j++) {
                for (let k = 0; k < 3; k++) {
                  beta_test[j] += invXtX[j][k] * XtY_test[k];
                }
              }
              
              // Calculate R² for this period
              let ssRes_test = 0, ssTot_test = 0;
              const clockMeanTest = clockExpr.reduce((a, b) => a + b, 0) / n;
              for (let i = 0; i < n; i++) {
                const t = sortedTimepoints[i];
                const pred = beta_test[0] + beta_test[1]*Math.cos(omega_test*t) + beta_test[2]*Math.sin(omega_test*t);
                ssRes_test += (clockExpr[i] - pred) ** 2;
                ssTot_test += (clockExpr[i] - clockMeanTest) ** 2;
              }
              const r2 = ssTot_test > 0 ? 1 - ssRes_test / ssTot_test : 0;
              
              if (r2 > bestR2) {
                bestR2 = r2;
                bestPeriod = period;
              }
            }
          }
          
          // Refit with best period using proper 3-parameter regression
          const omega = 2 * Math.PI / bestPeriod;
          let XtX_phase = [[0,0,0],[0,0,0],[0,0,0]];
          let XtY_phase = [0,0,0];
          
          for (let i = 0; i < n; i++) {
            const t = sortedTimepoints[i];
            const cosT = Math.cos(omega * t);
            const sinT = Math.sin(omega * t);
            const row = [1, cosT, sinT];
            for (let j = 0; j < 3; j++) {
              XtY_phase[j] += row[j] * clockExpr[i];
              for (let k = 0; k < 3; k++) {
                XtX_phase[j][k] += row[j] * row[k];
              }
            }
          }
          
          // Solve for [M, A, B] where C(t) = M + A·cos(ωt) + B·sin(ωt)
          const det_phase = XtX_phase[0][0]*(XtX_phase[1][1]*XtX_phase[2][2]-XtX_phase[1][2]*XtX_phase[2][1]) 
                          - XtX_phase[0][1]*(XtX_phase[1][0]*XtX_phase[2][2]-XtX_phase[1][2]*XtX_phase[2][0]) 
                          + XtX_phase[0][2]*(XtX_phase[1][0]*XtX_phase[2][1]-XtX_phase[1][1]*XtX_phase[2][0]);
          
          let clockPhaseOffset = 0;
          if (Math.abs(det_phase) > 1e-10) {
            const invPhase = [
              [(XtX_phase[1][1]*XtX_phase[2][2]-XtX_phase[1][2]*XtX_phase[2][1])/det_phase, (XtX_phase[0][2]*XtX_phase[2][1]-XtX_phase[0][1]*XtX_phase[2][2])/det_phase, (XtX_phase[0][1]*XtX_phase[1][2]-XtX_phase[0][2]*XtX_phase[1][1])/det_phase],
              [(XtX_phase[1][2]*XtX_phase[2][0]-XtX_phase[1][0]*XtX_phase[2][2])/det_phase, (XtX_phase[0][0]*XtX_phase[2][2]-XtX_phase[0][2]*XtX_phase[2][0])/det_phase, (XtX_phase[0][2]*XtX_phase[1][0]-XtX_phase[0][0]*XtX_phase[1][2])/det_phase],
              [(XtX_phase[1][0]*XtX_phase[2][1]-XtX_phase[1][1]*XtX_phase[2][0])/det_phase, (XtX_phase[0][1]*XtX_phase[2][0]-XtX_phase[0][0]*XtX_phase[2][1])/det_phase, (XtX_phase[0][0]*XtX_phase[1][1]-XtX_phase[0][1]*XtX_phase[1][0])/det_phase]
            ];
            const phaseCoeffs = [0,0,0];
            for (let j = 0; j < 3; j++) {
              for (let k = 0; k < 3; k++) {
                phaseCoeffs[j] += invPhase[j][k] * XtY_phase[k];
              }
            }
            // phaseCoeffs = [M, A, B] where C(t) = M + A·cos(ωt) + B·sin(ωt)
            // This equals M + R·cos(ωt - φ) where R=sqrt(A²+B²), φ=atan2(B,A)
            const A_coeff = phaseCoeffs[1];
            const B_coeff = phaseCoeffs[2];
            clockPhaseOffset = Math.atan2(B_coeff, A_coeff); // Phase offset: φ = atan2(B, A)
          }
          
          // Compute phase at each timepoint: θ(t) = ωt - φ (so peak is at θ=0)
          const phases = sortedTimepoints.map(t => {
            let phase = (omega * t - clockPhaseOffset) % (2 * Math.PI);
            if (phase < 0) phase += 2 * Math.PI;
            return phase;
          });
          
          // Step 2: Assign phase gates (day: 0-π, night: π-2π)
          const gateAssignment = phases.map(p => p < Math.PI ? 'day' : 'night');
          
          // Step 3: Build ARX regression matrix
          // Model: Y(t) = β₀ + β₁·Y(t-1) + β₂·Y(t-2) + γ₀·C(t) + γ₁·C(t-1) + εt
          // This incorporates clock gene as exogenous input (ARX model)
          const Y: number[] = [];
          const X_arx: number[][] = [];
          const X_ar2: number[][] = []; // Uncoupled model for F-test comparison
          const gatesUsed: string[] = [];
          
          for (let t = 2; t < n; t++) {
            Y.push(targetExpr[t]);
            // ARX model: [1, Y(t-1), Y(t-2), C(t), C(t-1)]
            X_arx.push([1, targetExpr[t-1], targetExpr[t-2], clockExpr[t], clockExpr[t-1]]);
            // Simple AR(2) for comparison: [1, Y(t-1), Y(t-2)]
            X_ar2.push([1, targetExpr[t-1], targetExpr[t-2]]);
            gatesUsed.push(gateAssignment[t]);
          }
          
          if (Y.length < 6) continue; // Need enough data for 5-parameter model
          
          // Step 4: Solve ARX model via OLS (5 parameters)
          // β = (X'X)^(-1) X'Y
          const p_arx = 5;
          const XtX_arx: number[][] = Array(p_arx).fill(0).map(() => Array(p_arx).fill(0));
          const XtY_arx: number[] = Array(p_arx).fill(0);
          
          for (let i = 0; i < Y.length; i++) {
            for (let j = 0; j < p_arx; j++) {
              XtY_arx[j] += X_arx[i][j] * Y[i];
              for (let k = 0; k < p_arx; k++) {
                XtX_arx[j][k] += X_arx[i][j] * X_arx[i][k];
              }
            }
          }
          
          // Solve via Gaussian elimination with partial pivoting
          const solveLinearSystem = (A: number[][], b: number[]): number[] | null => {
            const size = b.length;
            const aug: number[][] = A.map((row, i) => [...row, b[i]]);
            
            for (let col = 0; col < size; col++) {
              // Partial pivoting
              let maxRow = col;
              for (let row = col + 1; row < size; row++) {
                if (Math.abs(aug[row][col]) > Math.abs(aug[maxRow][col])) {
                  maxRow = row;
                }
              }
              [aug[col], aug[maxRow]] = [aug[maxRow], aug[col]];
              
              if (Math.abs(aug[col][col]) < 1e-10) return null;
              
              // Eliminate
              for (let row = col + 1; row < size; row++) {
                const factor = aug[row][col] / aug[col][col];
                for (let j = col; j <= size; j++) {
                  aug[row][j] -= factor * aug[col][j];
                }
              }
            }
            
            // Back substitution
            const result = Array(size).fill(0);
            for (let i = size - 1; i >= 0; i--) {
              result[i] = aug[i][size];
              for (let j = i + 1; j < size; j++) {
                result[i] -= aug[i][j] * result[j];
              }
              result[i] /= aug[i][i];
            }
            return result;
          };
          
          const beta_arx = solveLinearSystem(XtX_arx, XtY_arx);
          if (!beta_arx || beta_arx.some(b => !isFinite(b))) continue;
          
          // Also solve uncoupled AR(2) for F-test comparison
          const XtX_ar2 = [[0,0,0],[0,0,0],[0,0,0]];
          const XtY_ar2 = [0,0,0];
          for (let i = 0; i < Y.length; i++) {
            for (let j = 0; j < 3; j++) {
              XtY_ar2[j] += X_ar2[i][j] * Y[i];
              for (let k = 0; k < 3; k++) {
                XtX_ar2[j][k] += X_ar2[i][j] * X_ar2[i][k];
              }
            }
          }
          const beta_ar2 = solveLinearSystem(XtX_ar2, XtY_ar2);
          if (!beta_ar2) continue;
          
          // Extract coefficients
          const beta0 = beta_arx[0]; // Intercept
          const beta1 = beta_arx[1]; // Y(t-1) coefficient - φ₁
          const beta2 = beta_arx[2]; // Y(t-2) coefficient - φ₂
          const gamma0 = beta_arx[3]; // C(t) coefficient - clock coupling
          const gamma1 = beta_arx[4]; // C(t-1) coefficient - lagged clock coupling
          
          // Uncoupled AR(2) coefficients for comparison
          const beta1_uncoupled = beta_ar2[1];
          const beta2_uncoupled = beta_ar2[2];
          
          // Guard against invalid coefficients
          if (!isFinite(beta0) || !isFinite(beta1) || !isFinite(beta2)) continue;
          
          // Step 5: Calculate residuals and R² for both models
          let ssRes_arx = 0, ssRes_ar2 = 0, ssTotCoupled = 0;
          const yMeanCoupled = Y.reduce((a, b) => a + b, 0) / Y.length;
          
          for (let i = 0; i < Y.length; i++) {
            const yPred_arx = beta_arx[0] + beta_arx[1]*X_arx[i][1] + beta_arx[2]*X_arx[i][2] + beta_arx[3]*X_arx[i][3] + beta_arx[4]*X_arx[i][4];
            const yPred_ar2 = beta_ar2[0] + beta_ar2[1]*X_ar2[i][1] + beta_ar2[2]*X_ar2[i][2];
            ssRes_arx += (Y[i] - yPred_arx) ** 2;
            ssRes_ar2 += (Y[i] - yPred_ar2) ** 2;
            ssTotCoupled += (Y[i] - yMeanCoupled) ** 2;
          }
          
          const rSquared_arx = ssTotCoupled > 0 ? 1 - ssRes_arx / ssTotCoupled : 0;
          const rSquared_ar2 = ssTotCoupled > 0 ? 1 - ssRes_ar2 / ssTotCoupled : 0;
          const rSquaredImprovement = rSquared_arx - rSquared_ar2;
          
          // Step 6: Nested F-test for coupling significance
          // F = [(SSR_ar2 - SSR_arx) / (p_arx - p_ar2)] / [SSR_arx / (n - p_arx)]
          const df1 = 2; // Additional parameters in ARX (gamma0, gamma1)
          const df2 = Y.length - 5; // Residual degrees of freedom
          const fStatistic = df2 > 0 && ssRes_arx > 0 
            ? ((ssRes_ar2 - ssRes_arx) / df1) / (ssRes_arx / df2)
            : 0;
          
          // F-distribution survival function using regularized incomplete beta function
          // Based on Numerical Recipes in C (Press et al.), betai function
          // P(F > f) = 1 - I_{x}(df1/2, df2/2) where x = df1*f / (df1*f + df2)
          
          // Log-gamma function using Lanczos approximation
          const logGamma = (z: number): number => {
            const g = 7;
            const c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028,
                      771.32342877765313, -176.61502916214059, 12.507343278686905,
                      -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
            if (z < 0.5) {
              return Math.log(Math.PI / Math.sin(Math.PI * z)) - logGamma(1 - z);
            }
            z -= 1;
            let x = c[0];
            for (let i = 1; i < g + 2; i++) {
              x += c[i] / (z + i);
            }
            const t = z + g + 0.5;
            return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
          };
          
          // Continued fraction for incomplete beta (Numerical Recipes betacf)
          const betaCF = (a: number, b: number, x: number): number => {
            const maxIter = 200;
            const eps = 3e-14;
            const fpMin = 1e-30;
            
            const qab = a + b;
            const qap = a + 1;
            const qam = a - 1;
            let c = 1;
            let d = 1 - qab * x / qap;
            if (Math.abs(d) < fpMin) d = fpMin;
            d = 1 / d;
            let h = d;
            
            for (let m = 1; m <= maxIter; m++) {
              const m2 = 2 * m;
              
              // First step (even)
              let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
              d = 1 + aa * d;
              if (Math.abs(d) < fpMin) d = fpMin;
              c = 1 + aa / c;
              if (Math.abs(c) < fpMin) c = fpMin;
              d = 1 / d;
              h *= d * c;
              
              // Second step (odd)
              aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
              d = 1 + aa * d;
              if (Math.abs(d) < fpMin) d = fpMin;
              c = 1 + aa / c;
              if (Math.abs(c) < fpMin) c = fpMin;
              d = 1 / d;
              const del = d * c;
              h *= del;
              
              if (Math.abs(del - 1) < eps) break;
            }
            return h;
          };
          
          // Regularized incomplete beta function I_x(a,b)
          const incompleteBeta = (a: number, b: number, x: number): number => {
            if (x <= 0) return 0;
            if (x >= 1) return 1;
            
            const logBeta = logGamma(a) + logGamma(b) - logGamma(a + b);
            
            // Use symmetry for numerical stability
            if (x < (a + 1) / (a + b + 2)) {
              // Compute bt for (a, b, x)
              const bt = Math.exp(a * Math.log(x) + b * Math.log(1 - x) - logBeta);
              return bt * betaCF(a, b, x) / a;
            } else {
              // Use symmetry: I_x(a,b) = 1 - I_{1-x}(b,a)
              // Recompute bt for swapped parameters (b, a, 1-x)
              const y = 1 - x;
              const bt_swapped = Math.exp(b * Math.log(y) + a * Math.log(1 - y) - logBeta);
              return 1 - bt_swapped * betaCF(b, a, y) / b;
            }
          };
          
          let couplingPValue = 1;
          if (fStatistic > 0 && df2 > 0) {
            // F CDF in terms of incomplete beta: P(F <= f) = I_x(df1/2, df2/2)
            // where x = df1*f / (df1*f + df2)
            const x = (df1 * fStatistic) / (df1 * fStatistic + df2);
            const cdf = incompleteBeta(df1 / 2, df2 / 2, x);
            couplingPValue = Math.max(1e-16, 1 - cdf); // P(F > f) = 1 - CDF
          }
          
          const couplingSignificant = couplingPValue < 0.05;
          
          // Step 7: Phase-gated analysis - compute gate-specific coefficients
          const dayIndices = gatesUsed.map((g, i) => g === 'day' ? i : -1).filter(i => i >= 0);
          const nightIndices = gatesUsed.map((g, i) => g === 'night' ? i : -1).filter(i => i >= 0);
          
          let phaseGatedCoeffs = { day: { beta1: 0, beta2: 0 }, night: { beta1: 0, beta2: 0 } };
          
          // Fit separate AR(2) for each phase gate if enough data
          for (const [gateName, indices] of [['day', dayIndices], ['night', nightIndices]] as const) {
            if (indices.length >= 4) {
              const gateY = indices.map(i => Y[i]);
              const gateX = indices.map(i => X_ar2[i]);
              
              const gateXtX = [[0,0,0],[0,0,0],[0,0,0]];
              const gateXtY = [0,0,0];
              for (let i = 0; i < gateY.length; i++) {
                for (let j = 0; j < 3; j++) {
                  gateXtY[j] += gateX[i][j] * gateY[i];
                  for (let k = 0; k < 3; k++) {
                    gateXtX[j][k] += gateX[i][j] * gateX[i][k];
                  }
                }
              }
              const gateBeta = solveLinearSystem(gateXtX, gateXtY);
              if (gateBeta && gateBeta.every(b => isFinite(b))) {
                phaseGatedCoeffs[gateName].beta1 = gateBeta[1];
                phaseGatedCoeffs[gateName].beta2 = gateBeta[2];
              }
            }
          }
          
          // Check if coefficients differ between gates (phase-gating evidence)
          const coeffDiff = Math.abs(phaseGatedCoeffs.day.beta1 - phaseGatedCoeffs.night.beta1) +
                           Math.abs(phaseGatedCoeffs.day.beta2 - phaseGatedCoeffs.night.beta2);
          const hasPhaseGating = coeffDiff > 0.1;
          
          // Eigenvalue analysis: λ² - β₁λ - β₂ = 0
          // Real data from Jan 2026 audit (33 datasets):
          // Target genes: mean=0.537±0.232, Clock genes: mean=0.689±0.203
          // Note: Band center ~0.62 coincides with 1/φ but this is treated as empirical observation, not theoretical claim
          const PHI = GOLDEN_RATIO; // ≈ 1.618 (historical reference)
          const INV_PHI = 1 / GOLDEN_RATIO; // ≈ 0.618 (band center, empirically observed)
          const PSI = (1 - Math.sqrt(5)) / 2; // ≈ -0.618 (historical reference)
          
          const discriminant = beta1 * beta1 + 4 * beta2;
          let eigenvalue1Real = 0, eigenvalue1Imag = 0;
          let eigenvalue2Real = 0, eigenvalue2Imag = 0;
          let isComplex = false;
          let eigenperiod: number | null = null;
          let modulus = 0;
          
          // Band proximity: how close is modulus to empirical band center (~0.62)?
          // Real data (Jan 2026 audit): Target genes=0.537, Clock genes=0.689
          let bandProximity = 0;
          let inStabilityBand = false;
          let eigenvalueAnalysis = {
            targetModulus: INV_PHI,
            actualModulus: 0,
            distanceFromTarget: 0,
            psiValue: PSI
          };
          
          if (discriminant >= 0) {
            // Real eigenvalues
            eigenvalue1Real = (beta1 + Math.sqrt(discriminant)) / 2;
            eigenvalue2Real = (beta1 - Math.sqrt(discriminant)) / 2;
            modulus = Math.max(Math.abs(eigenvalue1Real), Math.abs(eigenvalue2Real));
          } else {
            // Complex eigenvalues (damped oscillations - typical for circadian data)
            isComplex = true;
            eigenvalue1Real = beta1 / 2;
            eigenvalue1Imag = Math.sqrt(-discriminant) / 2;
            eigenvalue2Real = beta1 / 2;
            eigenvalue2Imag = -Math.sqrt(-discriminant) / 2;
            modulus = Math.sqrt(eigenvalue1Real * eigenvalue1Real + eigenvalue1Imag * eigenvalue1Imag);
            
            // Eigenperiod from complex eigenvalue phase
            const theta = Math.atan2(eigenvalue1Imag, eigenvalue1Real);
            if (Math.abs(theta) > 0.001) {
              const samplingInterval = sortedTimepoints.length > 1 ? sortedTimepoints[1] - sortedTimepoints[0] : 2;
              eigenperiod = (2 * Math.PI / Math.abs(theta)) * samplingInterval;
            }
          }
          
          const isStable = modulus < 1;
          
          // Band proximity: How close is the modulus to band center (~0.62)?
          // Works for BOTH real and complex eigenvalues
          eigenvalueAnalysis.actualModulus = modulus;
          eigenvalueAnalysis.distanceFromTarget = Math.abs(modulus - INV_PHI);
          
          // Proximity = 1 - distance/maxDistance, where maxDistance ≈ 0.618
          // This gives 100% proximity when modulus = band center
          const maxDistance = Math.max(INV_PHI, 1 - INV_PHI);
          bandProximity = Math.max(0, (1 - eigenvalueAnalysis.distanceFromTarget / maxDistance)) * 100;
          
          // In stability band if modulus ∈ [0.40, 0.80] (real data range) and stable
          inStabilityBand = eigenvalueAnalysis.distanceFromTarget < 0.15 && isStable;
          
          // Use ARX R² as primary model fit
          const rSquared = rSquared_arx;
          
          results.push({
            clockGene: clockName,
            targetGene: targetName,
            workings: {
              step1_arx_equation: `Y(t) = ${beta0.toFixed(4)} + ${beta1.toFixed(4)}·Y(t-1) + ${beta2.toFixed(4)}·Y(t-2) + ${gamma0.toFixed(4)}·C(t) + ${gamma1.toFixed(4)}·C(t-1)`,
              step2_coefficients: { 
                beta0: beta0, beta1: beta1, beta2: beta2,
                gamma0: gamma0, gamma1: gamma1,
                uncoupled_beta1: beta1_uncoupled, uncoupled_beta2: beta2_uncoupled
              },
              step3_eigenvalues: {
                characteristicEquation: `λ² - ${beta1.toFixed(4)}λ - ${beta2.toFixed(4)} = 0`,
                discriminant: discriminant,
                isComplex: isComplex,
                eigenvalue1: isComplex ? `${eigenvalue1Real.toFixed(4)} + ${eigenvalue1Imag.toFixed(4)}i` : eigenvalue1Real.toFixed(4),
                eigenvalue2: isComplex ? `${eigenvalue2Real.toFixed(4)} - ${Math.abs(eigenvalue2Imag).toFixed(4)}i` : eigenvalue2Real.toFixed(4),
                modulus: modulus,
                eigenperiodHours: eigenperiod
              },
              step4_stabilityBand: {
                methodology: 'Modulus proximity to empirical stability band center (~0.62)',
                targetModulus: INV_PHI,
                actualModulus: modulus,
                distanceFromTarget: eigenvalueAnalysis.distanceFromTarget,
                formula: '1 - |modulus - 0.62| / 0.618',
                bandProximity: bandProximity,
                inStabilityBand: inStabilityBand,
                threshold: 'Modulus ∈ [0.40, 0.80] (real data range: target-clock genes)'
              },
              step5_stability: { modulus: modulus, threshold: 1, isStable: isStable, interpretation: isStable ? 'Oscillations decay (stable)' : 'Oscillations grow (unstable)' },
              step6_modelFit: { rSquared_arx: rSquared_arx, rSquared_ar2: rSquared_ar2, rSquaredImprovement: rSquaredImprovement, nObservations: Y.length },
              step7_coupling: {
                fStatistic: fStatistic,
                pValue: couplingPValue,
                couplingSignificant: couplingSignificant,
                clockCoupling: { gamma0: gamma0, gamma1: gamma1 }
              },
              step8_phaseGating: {
                hasPhaseGating: hasPhaseGating,
                dayCoeffs: phaseGatedCoeffs.day,
                nightCoeffs: phaseGatedCoeffs.night,
                coeffDifference: coeffDiff
              },
              step9_chronotherapy: (() => {
                const normalizedPhase = ((clockPhaseOffset % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
                const peakTimeHours = (normalizedPhase / (2 * Math.PI)) * bestPeriod;
                const normalizedPeakHours = ((peakTimeHours % 24) + 24) % 24;
                const windowStart = normalizedPeakHours;
                const windowEnd = ((normalizedPeakHours + 2) % 24 + 24) % 24;
                return {
                  clockPeriodHours: bestPeriod,
                  clockPhaseOffsetRadians: normalizedPhase,
                  clockPeakTimeHours: normalizedPeakHours,
                  optimalWindowStart: windowStart,
                  optimalWindowEnd: windowEnd
                };
              })()
            },
            summary: {
              bandProximity: bandProximity,
              inStabilityBand: inStabilityBand,
              eigenperiodHours: eigenperiod,
              isStable: isStable,
              rSquared: rSquared,
              couplingSignificant: couplingSignificant,
              hasPhaseGating: hasPhaseGating,
              clockPeakTimeHours: ((((clockPhaseOffset % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) / (2 * Math.PI)) * bestPeriod % 24
            }
          });
        }
      }
      
      // Sort by band proximity
      results.sort((a, b) => b.summary.bandProximity - a.summary.bandProximity);
      
      // Calculate statistics
      const inStabilityBandCount = results.filter(r => r.summary.inStabilityBand).length;
      const stableCount = results.filter(r => r.summary.isStable).length;
      const avgSimilarity = results.length > 0 ? results.reduce((s, r) => s + r.summary.bandProximity, 0) / results.length : 0;
      
      // Null expectation (from prior analysis)
      const nullRate = 0.04; // 4% expected by chance for stable AR(2)
      const observedRate = results.length > 0 ? inStabilityBandCount / results.length : 0;
      const enrichment = nullRate > 0 ? observedRate / nullRate : 0;
      
      // Binomial test (one-tailed, testing for enrichment)
      // Uses normal approximation to binomial for larger samples
      let binomialPValue = 1;
      const n = results.length; // Integer count
      const k = inStabilityBandCount; // Integer count of successes
      if (n > 0 && nullRate > 0 && k > 0) {
        const expected = n * nullRate;
        const variance = n * nullRate * (1 - nullRate);
        if (variance > 0) {
          // Continuity correction for normal approximation
          const zScore = (k - 0.5 - expected) / Math.sqrt(variance);
          // Standard normal CDF approximation for upper tail
          if (zScore > 0) {
            // Use erfc approximation for upper tail probability
            const t = 1 / (1 + 0.2316419 * zScore);
            const d = 0.3989423 * Math.exp(-zScore * zScore / 2);
            binomialPValue = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
          }
        }
      }
      
      // Count coupling statistics
      const couplingSignificantCount = results.filter(r => r.summary.couplingSignificant).length;
      const phaseGatingCount = results.filter(r => r.summary.hasPhaseGating).length;
      
      res.json({
        dataset: actualDatasetName,
        methodology: {
          description: "Phase-Gated ARX Stability Band Temporal Coupling Analysis",
          goldenRatio: GOLDEN_RATIO,
          stabilityBandCenter: 1/GOLDEN_RATIO,
          rationale: "The optimal stability band is centered on 1/φ ≈ 0.618, representing moderate damping dynamics",
          model: "Y(t) = β₀ + φ₁(θt)·Y(t-1) + φ₂(θt)·Y(t-2) + γ₀·C(t) + γ₁·C(t-1)",
          steps: [
            "1. Extract clock gene phase θt via cosine fitting to circadian data",
            "2. Fit ARX model: Y(t) = β₀ + β₁·Y(t-1) + β₂·Y(t-2) + γ₀·C(t) + γ₁·C(t-1)",
            "3. Compute nested F-test: ARX(5) vs AR(2)(3) to test coupling significance",
            "4. Assign phase gates (day: θ∈[0,π], night: θ∈[π,2π]) and fit gate-specific coefficients",
            "5. Solve eigenvalues: λ = (β₁ ± √(β₁² + 4β₂)) / 2",
            "6. Compute modulus |λ| and band proximity: 1 - |modulus - 1/φ| / 0.618",
            "7. In stability band if modulus within 0.1 of 0.618 (stable only)",
            "8. Compare observed stability band rate to null expectation (~4%)"
          ]
        },
        statistics: {
          totalPairsTested: results.length,
          inStabilityBandCount: inStabilityBandCount,
          inStabilityBandRate: (observedRate * 100).toFixed(2) + '%',
          stablePairs: stableCount,
          averageBandProximity: avgSimilarity.toFixed(2) + '%',
          nullExpectation: (nullRate * 100).toFixed(2) + '%',
          enrichmentRatio: enrichment.toFixed(2) + 'x',
          binomialPValue: binomialPValue < 0.001 ? '< 0.001' : binomialPValue.toFixed(4),
          significance: binomialPValue < 0.001 ? 'HIGHLY SIGNIFICANT' : binomialPValue < 0.05 ? 'SIGNIFICANT' : 'NOT SIGNIFICANT',
          couplingSignificantPairs: couplingSignificantCount,
          couplingRate: results.length > 0 ? ((couplingSignificantCount / results.length) * 100).toFixed(2) + '%' : '0%',
          phaseGatingPairs: phaseGatingCount,
          phaseGatingRate: results.length > 0 ? ((phaseGatingCount / results.length) * 100).toFixed(2) + '%' : '0%'
        },
        topStabilityBandPairs: results.slice(0, 20),
        allResults: results
      });
    } catch (error) {
      console.error("Error running stability band analysis:", error);
      res.status(500).json({ error: `Failed to run stability band analysis: ${error}` });
    }
  });

  // Genome-wide PAR(2) screening - tests all genes against clock genes
  app.post("/api/analyses/genome-wide-screen", upload.single("dataset"), async (req: Request, res) => {
    try {
      const { name, datasetName, fdrThreshold, maxResults } = req.body;
      
      let parsedData: ParsedDataset;
      let actualDatasetName = datasetName || (req.file ? req.file.originalname : 'unknown');
      
      if (req.file) {
        console.log(`Genome-wide screening: parsing ${req.file.originalname}`);
        parsedData = await parseDatasetBuffer(req.file.buffer, req.file.originalname);
      } else if (datasetName) {
        const safeDatasetName = sanitizePathParam(datasetName);
        const embeddedPath = path.join(process.cwd(), 'datasets', safeDatasetName);
        if (fs.existsSync(embeddedPath)) {
          const buffer = fs.readFileSync(embeddedPath);
          parsedData = await parseDatasetBuffer(buffer, safeDatasetName);
        } else {
          return res.status(400).json({ error: "Dataset not found" });
        }
      } else {
        return res.status(400).json({ error: "No dataset provided" });
      }
      
      console.log(`Starting genome-wide screen: ${parsedData.geneIds.length} genes, ${parsedData.timepoints.length} timepoints`);
      
      // Create analysis run in database
      const analysisName = name || `Genome-Wide Screen: ${actualDatasetName}`;
      const run = await storage.createAnalysisRun({
        name: analysisName,
        datasetName: actualDatasetName,
        status: "running"
      });
      
      const result = runGenomeWideScreen(
        parsedData.geneTimeSeries,
        parsedData.timepoints,
        ['Per2', 'Arntl', 'Clock', 'Per1', 'Cry1', 'Cry2', 'Nr1d1', 'Nr1d2'],
        {
          fdrThreshold: parseFloat(fdrThreshold) || 0.05,
          maxResults: parseInt(maxResults) || 500
        }
      );
      
      console.log(`Genome-wide screen complete: ${result.totalGenesScreened} genes, ${result.significantHits} significant hits`);
      
      // Save significant hits as hypotheses
      const hypotheses = result.topHits.map((hit: any) => ({
        runId: run.id,
        targetGene: hit.targetGeneSymbol || hit.targetGene,
        targetRole: "Genome-Wide Hit",
        clockGene: hit.clockGeneSymbol || hit.clockGene,
        clockRole: getClockRole(hit.clockGeneSymbol || hit.clockGene),
        significant: hit.fdrSignificant,
        pValue: hit.pValue,
        fdrAdjustedPValue: hit.correctedPValue,
        significantAfterFDR: hit.fdrSignificant,
        significantTerms: hit.fdrSignificant ? ['FDR < 0.05'] : [],
        description: hit.fdrSignificant 
          ? `Significant circadian gating (FDR-corrected P = ${hit.correctedPValue?.toFixed(4) || 'N/A'})`
          : `Not significant (P = ${hit.pValue?.toFixed(4) || 'N/A'})`,
        effectSizeCohensF2: null,
        effectSizeInterpretation: hit.effectSize || null,
        rSquaredChange: hit.rSquared || null,
        confidenceIntervals: null,
        modelQuality: hit.fdrSignificant ? 'high' : 'low'
      }));
      
      // Store hypotheses in batches
      for (const h of hypotheses) {
        await storage.createHypothesis(h);
      }
      
      // Mark run as completed
      await storage.updateAnalysisRunStatus(run.id, "completed", new Date());
      
      res.json({
        runId: run.id,
        ...result
      });
    } catch (error) {
      console.error("Error running genome-wide screen:", error);
      res.status(500).json({ error: `Failed to run genome-wide screen: ${error}` });
    }
  });
  
  // Helper function for clock gene roles
  function getClockRole(clockGene: string): string {
    const roles: Record<string, string> = {
      'Arntl': 'Positive Limb/BMAL1',
      'Clock': 'Positive Limb/CLOCK',
      'Per1': 'Negative Limb/PER',
      'Per2': 'Negative Limb/PER',
      'Cry1': 'Negative Limb/CRY',
      'Cry2': 'Negative Limb/CRY',
      'Nr1d1': 'Stabilizing Loop/REV-ERB',
      'Nr1d2': 'Stabilizing Loop/REV-ERB'
    };
    return roles[clockGene] || 'Clock Gene';
  }

  // Run PAR(2) analysis
  app.post("/api/analyses/run", upload.single("dataset"), async (req: Request, res) => {
    try {
      const { name, datasetName, period, threshold, pairs } = req.body;
      
      if (!name || !datasetName) {
        return res.status(400).json({ error: "Missing required fields: name, datasetName" });
      }

      const analysisConfig = {
        period: parseInt(period) || 24,
        threshold: parseFloat(threshold) || 0.05,
        pairs: pairs ? JSON.parse(pairs) : DEFAULT_PAIRS
      };

      const run = await storage.createAnalysisRun({
        name,
        datasetName,
        status: "running"
      });

      // Process in background
      setImmediate(async () => {
        try {
          let parsedData: ParsedDataset;
          
          if (req.file) {
            console.log(`Parsing uploaded file: ${req.file.originalname} (format detection)`);
            parsedData = await parseDatasetBuffer(req.file.buffer, req.file.originalname);
            console.log(`Detected format: ${parsedData.format}, ${parsedData.geneIds.length} genes, ${parsedData.timepoints.length} timepoints`);
            // Log upload activity for analytics
            try {
              await storage.createAnalyticsEvent({
                eventType: 'file_upload',
                page: `/discovery-engine`,
                sessionId: `upload_${Date.now()}`,
                referrer: JSON.stringify({
                  fileName: req.file.originalname,
                  fileSize: req.file.size,
                  geneCount: parsedData.geneIds.length,
                  timepointCount: parsedData.timepoints.length,
                  format: parsedData.format
                })
              });
            } catch (e) { /* don't fail analysis for logging */ }
          } else {
            console.log("No file uploaded, using mock data");
            parsedData = generateMockData(analysisConfig.period);
          }

          const par2Config: PAR2Config = {
            period: analysisConfig.period,
            significanceThreshold: analysisConfig.threshold
          };

          const hypothesesToInsert = [];

          for (const pair of analysisConfig.pairs) {
            const targetGene = CANDIDATES.find(c => c.name === pair.target);
            const clockGene = CLOCKS.find(c => c.name === pair.clock);

            if (!targetGene || !clockGene) {
              console.warn(`Skipping unknown pair: ${pair.target} × ${pair.clock}`);
              continue;
            }

            // Get time series for this gene pair - check both ID and name
            const targetValues = findGeneData(parsedData, targetGene);
            const clockValues = findGeneData(parsedData, clockGene);

            const hasTargetData = targetValues && targetValues.length > 0 && targetValues.some(v => v !== 0);
            const hasClockData = clockValues && clockValues.length > 0 && clockValues.some(v => v !== 0);

            let result: PAR2Result;
            let geneNotFound = false;
            
            if (hasTargetData && hasClockData) {
              const targetData: GeneData = {
                time: parsedData.timepoints,
                expression: targetValues!
              };
              const clockData: GeneData = {
                time: parsedData.timepoints,
                expression: clockValues!
              };
              
              result = runPAR2Analysis(targetData, clockData, par2Config);
              
              // Apply within-pair Bonferroni correction (×4 for 4 interaction terms)
              const rawPValue = result.pValue;
              result.pValue = applyWithinPairBonferroni(result.pValue);
              console.log(`PAR2 result for ${clockGene.name}→${targetGene.name}: raw_p=${rawPValue.toFixed(4)}, corrected_p=${result.pValue.toFixed(4)}, significant=${result.significant}`);
            } else {
              geneNotFound = true;
              result = {
                significant: false,
                pValue: 1.0,
                significantTerms: []
              };
              console.log(`Gene not found: ${targetGene.name}=${hasTargetData}, ${clockGene.name}=${hasClockData}`);
            }

            // Re-evaluate significance after Bonferroni correction
            const isSignificant = result.pValue < analysisConfig.threshold;
            
            const description = geneNotFound 
              ? `Gene data not available in dataset`
              : isSignificant
                ? `Significant Phase-Gating found! ${clockGene.name} modulates ${targetGene.name} expression timing.`
                : `No significant modulation detected (P-value: ${result.pValue.toFixed(4)})`;

            hypothesesToInsert.push({
              runId: run.id,
              targetGene: targetGene.name,
              targetRole: targetGene.role,
              clockGene: clockGene.name,
              clockRole: clockGene.role,
              significant: isSignificant,
              pValue: result.pValue,
              significantTerms: result.significantTerms,
              description,
              effectSizeCohensF2: result.effectSize?.cohensF2 ?? null,
              effectSizeInterpretation: result.effectSize?.cohensF2Interpretation ?? null,
              rSquaredChange: result.effectSize?.rSquaredChange ?? null,
              confidenceIntervals: result.confidenceIntervals ?? null
            });
          }

          await storage.bulkCreateHypotheses(hypothesesToInsert);
          
          // Apply FDR correction across all pairs in this run
          await applyFDRCorrectionToRun(run.id, analysisConfig.threshold);
          
          await storage.updateAnalysisRunStatus(run.id, "completed", new Date());
          
          logger.analysis('Analysis completed', {
            runId: run.id,
            hypothesesCount: hypothesesToInsert.length,
            datasetName: run.datasetName
          });
        } catch (error) {
          logger.error("Error running analysis", { error: String(error), runId: run.id });
          await storage.updateAnalysisRunStatus(run.id, "failed");
        }
      });

      res.json({ run });
    } catch (error) {
      console.error("Error creating analysis:", error);
      res.status(500).json({ error: "Failed to create analysis" });
    }
  });

  // Run full PAR(2) analysis on an embedded dataset
  app.post("/api/analyses/embedded/:id/run", async (req, res) => {
    try {
      const datasetId = sanitizePathParam(req.params.id);
      const { name, period, threshold, allPairs } = req.body;
      
      // Find the dataset file - check for both .csv and .csv.gz
      let filepath = path.join(process.cwd(), 'datasets', datasetId + '.csv');
      let filename = datasetId + '.csv';
      
      if (!fs.existsSync(filepath)) {
        filepath = path.join(process.cwd(), 'datasets', datasetId + '.csv.gz');
        filename = datasetId + '.csv.gz';
      }
      
      if (!fs.existsSync(filepath)) {
        return res.status(404).json({ error: `Dataset not found: ${datasetId}` });
      }
      
      const analysisConfig = {
        period: parseInt(period) || 24,
        threshold: parseFloat(threshold) || 0.05,
        pairs: allPairs ? getAllPairs(datasetId) : getDefaultPairs(datasetId)
      };
      
      const analysisName = name || `Full Analysis - ${datasetId}`;
      
      const run = await storage.createAnalysisRun({
        name: analysisName,
        datasetName: filename,
        status: "running"
      });
      
      // Process in background
      setImmediate(async () => {
        try {
          console.log(`Loading embedded dataset: ${filepath}`);
          const buffer = fs.readFileSync(filepath);
          const parsedData = await parseDatasetBuffer(buffer, filename);
          console.log(`Parsed: ${parsedData.geneIds.length} genes, ${parsedData.timepoints.length} timepoints`);
          
          const par2Config: PAR2Config = {
            period: analysisConfig.period,
            significanceThreshold: analysisConfig.threshold
          };
          
          const hypothesesToInsert = [];
          const clocks = getClocksForDataset(datasetId);
          const targets = getTargetsForDataset(datasetId);
          
          for (const pair of analysisConfig.pairs) {
            const targetGene = targets.find(c => c.name === pair.target);
            const clockGene = clocks.find(c => c.name === pair.clock);
            
            if (!targetGene || !clockGene) {
              console.warn(`Skipping unknown pair: ${pair.target} × ${pair.clock}`);
              continue;
            }
            
            const targetValues = findGeneData(parsedData, targetGene);
            const clockValues = findGeneData(parsedData, clockGene);
            
            const hasTargetData = targetValues && targetValues.length > 0 && targetValues.some(v => v !== 0);
            const hasClockData = clockValues && clockValues.length > 0 && clockValues.some(v => v !== 0);
            
            let result: PAR2Result;
            let geneNotFound = false;
            
            if (hasTargetData && hasClockData) {
              const targetData: GeneData = {
                time: parsedData.timepoints,
                expression: targetValues!
              };
              const clockData: GeneData = {
                time: parsedData.timepoints,
                expression: clockValues!
              };
              
              result = runPAR2Analysis(targetData, clockData, par2Config);
              
              // Apply within-pair Bonferroni correction (×4 for 4 interaction terms)
              const rawPValue = result.pValue;
              result.pValue = applyWithinPairBonferroni(result.pValue);
              console.log(`PAR2 result for ${clockGene.name}→${targetGene.name}: raw_p=${rawPValue.toFixed(4)}, corrected_p=${result.pValue.toFixed(4)}, significant=${result.significant}`);
            } else {
              geneNotFound = true;
              result = {
                significant: false,
                pValue: 1.0,
                significantTerms: []
              };
            }
            
            // Re-evaluate significance after Bonferroni correction
            const isSignificant = result.pValue < analysisConfig.threshold;
            
            const description = geneNotFound 
              ? `Gene data not available in dataset`
              : isSignificant
                ? `Significant Phase-Gating found! ${clockGene.name} modulates ${targetGene.name} expression timing.`
                : `No significant modulation detected (P-value: ${result.pValue.toFixed(4)})`;
            
            hypothesesToInsert.push({
              runId: run.id,
              targetGene: targetGene.name,
              targetRole: targetGene.role,
              clockGene: clockGene.name,
              clockRole: clockGene.role,
              significant: isSignificant,
              pValue: result.pValue,
              significantTerms: result.significantTerms,
              description,
              effectSizeCohensF2: result.effectSize?.cohensF2 ?? null,
              effectSizeInterpretation: result.effectSize?.cohensF2Interpretation ?? null,
              rSquaredChange: result.effectSize?.rSquaredChange ?? null,
              confidenceIntervals: result.confidenceIntervals ?? null
            });
          }
          
          await storage.bulkCreateHypotheses(hypothesesToInsert);
          
          // Apply FDR correction across all pairs in this run
          await applyFDRCorrectionToRun(run.id, analysisConfig.threshold);
          
          await storage.updateAnalysisRunStatus(run.id, "completed", new Date());
          
          logger.analysis('Embedded analysis completed', {
            runId: run.id,
            hypothesesCount: hypothesesToInsert.length,
            datasetName: run.datasetName
          });
        } catch (error) {
          logger.error("Error running embedded analysis", { error: String(error), runId: run.id });
          await storage.updateAnalysisRunStatus(run.id, "failed");
        }
      });
      
      res.json({ run, message: `Analysis started for ${datasetId} with ${analysisConfig.pairs.length} pairs` });
    } catch (error) {
      console.error("Error creating embedded analysis:", error);
      res.status(500).json({ error: "Failed to create analysis" });
    }
  });

  // ============================================
  // PROTEOMICS ANALYSIS ENDPOINTS
  // ============================================

  // Get all proteomics analysis runs
  app.get("/api/proteomics", async (req, res) => {
    try {
      const runs = await storage.getAllProteomicsRuns();
      res.json(runs);
    } catch (error) {
      console.error("Error fetching proteomics runs:", error);
      res.status(500).json({ error: "Failed to fetch proteomics runs" });
    }
  });

  // Get proteomics run with results
  app.get("/api/proteomics/:id", async (req, res) => {
    try {
      const result = await storage.getProteomicsRunWithResults(req.params.id);
      if (!result) {
        return res.status(404).json({ error: "Proteomics run not found" });
      }
      res.json(result);
    } catch (error) {
      console.error("Error fetching proteomics run:", error);
      res.status(500).json({ error: "Failed to fetch proteomics run" });
    }
  });

  // Helper function to apply FDR correction to proteomics results
  async function applyFDRCorrectionToProteomicsRun(runId: string, threshold: number = 0.05): Promise<{ significantBeforeFDR: number; significantAfterFDR: number }> {
    const results = await storage.getProteomicsResultsByRunId(runId);
    const validResults = results.filter(r => r.pValue !== null && r.pValue < 1.0);
    
    if (validResults.length === 0) {
      return { significantBeforeFDR: 0, significantAfterFDR: 0 };
    }
    
    const pValues = validResults.map(r => r.pValue as number);
    const { qValues, significant } = benjaminiHochberg(pValues, threshold);
    
    for (let i = 0; i < validResults.length; i++) {
      await storage.updateProteomicsResultFDR(validResults[i].id, qValues[i], significant[i]);
    }
    
    const invalidResults = results.filter(r => r.pValue === null || r.pValue >= 1.0);
    for (const res of invalidResults) {
      await storage.updateProteomicsResultFDR(res.id, 1.0, false);
    }
    
    return {
      significantBeforeFDR: results.filter(r => r.significant).length,
      significantAfterFDR: significant.filter(s => s).length
    };
  }

  // Upload and analyze proteomics data (CSV format)
  // Expected CSV format: First column = protein/gene ID, remaining columns = timepoints
  app.post("/api/proteomics/upload", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const { name, dataType, linkedTranscriptomicsRunId, period, threshold } = req.body;
      
      const csvContent = req.file.buffer.toString("utf-8");
      const records = parse(csvContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true
      }) as Record<string, string>[];

      if (records.length === 0) {
        return res.status(400).json({ error: "No data in CSV file" });
      }

      // Create proteomics run
      const run = await storage.createProteomicsRun({
        name: name || `Proteomics Analysis ${new Date().toISOString().split('T')[0]}`,
        datasetName: req.file.originalname || "Uploaded proteomics data",
        dataType: dataType || "protein",
        status: "processing",
        linkedTranscriptomicsRunId: linkedTranscriptomicsRunId || null
      });

      // Process asynchronously using Promise.resolve().then() for better error handling
      const logFile = `/tmp/proteomics_debug_${run.id}.log`;
      const debugLog = (msg: string) => {
        const line = `${new Date().toISOString()} - ${msg}\n`;
        try { fs.appendFileSync(logFile, line); } catch (e) { /* ignore */ }
        console.log(`[PROTEOMICS ${run.id}] ${msg}`);
      };
      
      Promise.resolve().then(async () => {
        debugLog(`Proteomics analysis starting for run ${run.id}`);
        debugLog(`Records parsed: ${records.length}, First record keys: ${Object.keys(records[0] || {}).join(', ')}`);
        
        try {
          const columns = Object.keys(records[0]);
          const idColumn = columns[0];
          debugLog(`ID column: ${idColumn}, All columns: ${columns.join(', ')}`);
          
          // Handle both numeric columns (18, 20, etc.) and CT-prefixed columns (CT18, CT20, etc.)
          const timeColumns = columns.slice(1).filter(c => {
            // Check if purely numeric
            if (!isNaN(parseFloat(c))) return true;
            // Check if CT-prefixed (e.g., CT18, CT20)
            if (/^CT\d+$/i.test(c)) return true;
            // Check if ZT-prefixed (e.g., ZT0, ZT4)
            if (/^ZT\d+$/i.test(c)) return true;
            return false;
          });

          if (timeColumns.length < 6) {
            debugLog(`Proteomics analysis failed: only ${timeColumns.length} time columns found (need at least 6)`);
            await storage.updateProteomicsRunStatus(run.id, "failed");
            return;
          }

          // Extract numeric timepoints from column names (CT18 -> 18, ZT4 -> 4, or just numeric)
          const timepoints = timeColumns.map(c => {
            if (/^CT(\d+)$/i.test(c)) return parseInt(c.replace(/^CT/i, ''));
            if (/^ZT(\d+)$/i.test(c)) return parseInt(c.replace(/^ZT/i, ''));
            return parseFloat(c);
          });
          debugLog(`Timepoints extracted: ${timepoints.join(', ')}`);

          // Build gene data map with case-insensitive handling
          const geneDataMap = new Map<string, number[]>();
          for (const record of records) {
            const geneId = record[idColumn];
            const values = timeColumns.map(tc => parseFloat(record[tc]) || 0);
            if (values.some(v => !isNaN(v))) {
              // Store original, lowercase, uppercase, and title case versions
              geneDataMap.set(geneId, values);
              geneDataMap.set(geneId.toLowerCase(), values);
              geneDataMap.set(geneId.toUpperCase(), values);
              // Title case (first letter uppercase, rest lowercase) - matches CANDIDATES format
              const titleCase = geneId.charAt(0).toUpperCase() + geneId.slice(1).toLowerCase();
              geneDataMap.set(titleCase, values);
              
              // Also try to map gene symbols
              const symbol = ENSEMBL_TO_GENE_SYMBOL[geneId] || geneId;
              if (symbol !== geneId) {
                geneDataMap.set(symbol, values);
                geneDataMap.set(symbol.toLowerCase(), values);
                geneDataMap.set(symbol.toUpperCase(), values);
              }
            }
          }
          
          console.log(`Proteomics: Loaded ${geneDataMap.size} gene entries from ${records.length} rows`);
          console.log(`Proteomics: Sample gene IDs: ${Array.from(geneDataMap.keys()).slice(0, 10).join(', ')}`);
          console.log(`Proteomics: Looking for genes from ${CANDIDATES.length} candidates and ${CLOCKS.length} clocks`);
          

          const analysisConfig = {
            period: parseInt(period) || 24,
            significanceThreshold: parseFloat(threshold) || 0.05,
            pairs: getAllPairs()
          };

          const resultsToInsert: any[] = [];
          
          for (const pair of analysisConfig.pairs) {
            const targetGene = CANDIDATES.find(c => c.name === pair.target);
            const clockGene = CLOCKS.find(c => c.name === pair.clock);
            
            if (!targetGene || !clockGene) continue;

            // Try to find data for both genes
            const targetData = geneDataMap.get(pair.target) || 
                              geneDataMap.get(targetGene.id) ||
                              geneDataMap.get(pair.target.toLowerCase()) ||
                              geneDataMap.get(pair.target.toUpperCase());
            
            const clockData = geneDataMap.get(pair.clock) || 
                             geneDataMap.get(clockGene.id) ||
                             geneDataMap.get(pair.clock.toLowerCase()) ||
                             geneDataMap.get(pair.clock.toUpperCase());

            if (!targetData || !clockData) {
              resultsToInsert.push({
                runId: run.id,
                targetProtein: pair.target,
                targetGeneSymbol: pair.target,
                clockProtein: pair.clock,
                clockGeneSymbol: pair.clock,
                significant: false,
                pValue: 1.0,
                significantTerms: [],
                effectSizeCohensF2: null,
                effectSizeInterpretation: null,
                rSquaredChange: null,
                confidenceIntervals: null
              });
              continue;
            }

            // Run PAR2 analysis - construct GeneData objects with time and expression
            const targetGeneData: GeneData = { 
              time: timepoints, 
              expression: targetData 
            };
            const clockGeneData: GeneData = { 
              time: timepoints, 
              expression: clockData 
            };

            const result = runPAR2Analysis(targetGeneData, clockGeneData, {
              period: analysisConfig.period || 24,
              significanceThreshold: analysisConfig.significanceThreshold || 0.05
            });
            
            // Apply within-pair Bonferroni correction (×4 for 4 interaction terms)
            const correctedPValue = applyWithinPairBonferroni(result.pValue);
            const isSignificant = correctedPValue < (analysisConfig.significanceThreshold || 0.05);

            resultsToInsert.push({
              runId: run.id,
              targetProtein: pair.target,
              targetGeneSymbol: pair.target,
              clockProtein: pair.clock,
              clockGeneSymbol: pair.clock,
              significant: isSignificant,
              pValue: correctedPValue,
              significantTerms: result.significantTerms || [],
              effectSizeCohensF2: result.effectSize?.cohensF2 ?? null,
              effectSizeInterpretation: result.effectSize?.cohensF2Interpretation ?? null,
              rSquaredChange: result.effectSize?.rSquaredChange ?? null,
              confidenceIntervals: result.confidenceIntervals ?? null
            });
          }

          await storage.bulkCreateProteomicsResults(resultsToInsert);
          await applyFDRCorrectionToProteomicsRun(run.id, analysisConfig.significanceThreshold);
          await storage.updateProteomicsRunStatus(run.id, "completed", new Date());

          console.log(`Proteomics analysis ${run.id} completed with ${resultsToInsert.length} results`);
        } catch (error) {
          debugLog(`Error in proteomics analysis: ${error instanceof Error ? error.message : String(error)}`);
          debugLog(`Stack: ${error instanceof Error ? error.stack : 'N/A'}`);
          console.error("Error in proteomics analysis:", error);
          await storage.updateProteomicsRunStatus(run.id, "failed");
        }
      }).catch((err) => {
        debugLog(`Unhandled error in proteomics Promise chain: ${err instanceof Error ? err.message : String(err)}`);
        console.error("Unhandled proteomics error:", err);
        storage.updateProteomicsRunStatus(run.id, "failed").catch(() => {});
      });

      res.json({ run, message: "Proteomics analysis started" });
    } catch (error) {
      console.error("Error uploading proteomics data:", error);
      res.status(500).json({ error: "Failed to process proteomics upload" });
    }
  });

  // Compare mRNA (transcriptomics) vs protein (proteomics) results
  app.post("/api/concordance/analyze", async (req, res) => {
    try {
      const { transcriptomicsRunId, proteomicsRunId } = req.body;

      if (!transcriptomicsRunId || !proteomicsRunId) {
        return res.status(400).json({ error: "Both transcriptomicsRunId and proteomicsRunId are required" });
      }

      // Fetch both datasets
      const transcriptomicsData = await storage.getAnalysisRunWithHypotheses(transcriptomicsRunId);
      const proteomicsData = await storage.getProteomicsRunWithResults(proteomicsRunId);

      if (!transcriptomicsData) {
        return res.status(404).json({ error: "Transcriptomics run not found" });
      }
      if (!proteomicsData) {
        return res.status(404).json({ error: "Proteomics run not found" });
      }

      // Build lookup maps
      const mrnaMap = new Map<string, { pValue: number; significant: boolean }>();
      for (const hyp of transcriptomicsData.hypotheses) {
        const key = `${hyp.targetGene}-${hyp.clockGene}`;
        mrnaMap.set(key, { pValue: hyp.pValue || 1.0, significant: hyp.significant });
      }

      const proteinMap = new Map<string, { pValue: number; significant: boolean }>();
      for (const res of proteomicsData.results) {
        const key = `${res.targetGeneSymbol}-${res.clockGeneSymbol}`;
        proteinMap.set(key, { pValue: res.pValue || 1.0, significant: res.significant });
      }

      // Create concordance analysis
      const concordances: any[] = [];
      const allKeys = Array.from(new Set([...Array.from(mrnaMap.keys()), ...Array.from(proteinMap.keys())]));

      for (const key of allKeys) {
        const [targetGene, clockGene] = key.split('-');
        const mrna = mrnaMap.get(key);
        const protein = proteinMap.get(key);

        let status: string;
        let interpretation: string;

        if (mrna?.significant && protein?.significant) {
          status = 'both_significant';
          interpretation = 'High-confidence circadian gating: validated at both mRNA and protein levels';
        } else if (mrna?.significant && !protein?.significant) {
          status = 'mrna_only';
          interpretation = 'Transcriptional regulation without protein-level confirmation; possible post-transcriptional regulation or protein stability effects';
        } else if (!mrna?.significant && protein?.significant) {
          status = 'protein_only';
          interpretation = 'Post-transcriptional circadian regulation; protein stability or translation timing';
        } else {
          status = 'neither';
          interpretation = 'No significant circadian gating detected at either level';
        }

        concordances.push({
          transcriptomicsRunId,
          proteomicsRunId,
          targetGene,
          clockGene,
          mrnaPValue: mrna?.pValue ?? null,
          mrnaSignificant: mrna?.significant ?? false,
          proteinPValue: protein?.pValue ?? null,
          proteinSignificant: protein?.significant ?? false,
          concordanceStatus: status,
          interpretation
        });
      }

      // Store concordance results
      const storedConcordances = await storage.bulkCreateConcordance(concordances);

      // Calculate summary statistics
      const summary = {
        totalPairs: concordances.length,
        bothSignificant: concordances.filter(c => c.concordanceStatus === 'both_significant').length,
        mrnaOnly: concordances.filter(c => c.concordanceStatus === 'mrna_only').length,
        proteinOnly: concordances.filter(c => c.concordanceStatus === 'protein_only').length,
        neither: concordances.filter(c => c.concordanceStatus === 'neither').length,
        concordanceRate: 0
      };
      
      const anySignificant = summary.bothSignificant + summary.mrnaOnly + summary.proteinOnly;
      summary.concordanceRate = anySignificant > 0 ? (summary.bothSignificant / anySignificant * 100) : 0;

      res.json({
        transcriptomicsRun: transcriptomicsData.run,
        proteomicsRun: proteomicsData.run,
        concordances: storedConcordances,
        summary
      });
    } catch (error) {
      console.error("Error analyzing concordance:", error);
      res.status(500).json({ error: "Failed to analyze concordance" });
    }
  });

  // Get concordance results for a pair of runs
  app.get("/api/concordance/:transcriptomicsRunId/:proteomicsRunId", async (req, res) => {
    try {
      const { transcriptomicsRunId, proteomicsRunId } = req.params;
      const concordances = await storage.getConcordanceByRuns(transcriptomicsRunId, proteomicsRunId);
      
      if (concordances.length === 0) {
        return res.status(404).json({ error: "No concordance analysis found for these runs" });
      }

      const summary = {
        totalPairs: concordances.length,
        bothSignificant: concordances.filter(c => c.concordanceStatus === 'both_significant').length,
        mrnaOnly: concordances.filter(c => c.concordanceStatus === 'mrna_only').length,
        proteinOnly: concordances.filter(c => c.concordanceStatus === 'protein_only').length,
        neither: concordances.filter(c => c.concordanceStatus === 'neither').length
      };

      res.json({ concordances, summary });
    } catch (error) {
      console.error("Error fetching concordance:", error);
      res.status(500).json({ error: "Failed to fetch concordance" });
    }
  });

  // Download proteomics results as CSV
  app.get("/api/proteomics/:id/download", async (req, res) => {
    try {
      const result = await storage.getProteomicsRunWithResults(req.params.id);
      if (!result) {
        return res.status(404).json({ error: "Proteomics run not found" });
      }

      // Build metadata header with prominent dataset name
      const metadataHeader = [
        '# ========================================',
        '# PAR(2) Proteomics Results Export',
        '# ========================================',
        `# Engine Version: ${ENGINE_VERSION}`,
        `# Export Time (UTC): ${new Date().toISOString()}`,
        '#',
        `# DATASET: ${result.run.name}`,
        `# Dataset File: ${result.run.datasetName}`,
        `# Run ID: ${result.run.id}`,
        '#',
        `# Total Protein Pairs: ${result.results.length}`,
        `# Significant Pairs: ${result.results.filter(r => r.significant).length}`,
        '# ========================================',
        '#'
      ].join('\n');
      
      const headers = ['Target Protein', 'Clock Protein', 'Significant', 'P-Value', 'Q-Value', 'Effect Size (f²)', 'Effect Interpretation', 'Significant Terms'];
      const rows = result.results.map(r => [
        r.targetGeneSymbol,
        r.clockGeneSymbol,
        r.significant ? 'Yes' : 'No',
        r.pValue?.toFixed(6) || 'N/A',
        r.qValue?.toFixed(6) || 'N/A',
        r.effectSizeCohensF2?.toFixed(4) || 'N/A',
        r.effectSizeInterpretation || 'N/A',
        r.significantTerms?.join('; ') || ''
      ]);

      const csv = metadataHeader + '\n' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      
      const filename = generateAuditFilename('PAR2_Proteomics', 'csv', { 
        datasetName: result.run.name, 
        runId: result.run.id 
      });
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(csv);
    } catch (error) {
      console.error("Error downloading proteomics results:", error);
      res.status(500).json({ error: "Failed to download proteomics results" });
    }
  });

  // ============================================
  // END PROTEOMICS ENDPOINTS
  // ============================================

  // Batch job status tracking (in-memory for simplicity)
  interface BatchJob {
    id: string;
    status: 'running' | 'completed' | 'failed';
    totalTissues: number;
    completedTissues: number;
    currentTissue: string;
    results: Array<{
      tissue: string;
      runId: string;
      significantCount: number;
      significantAfterFDR?: number;
      totalPairs: number;
    }>;
    startedAt: Date;
    completedAt?: Date;
    error?: string;
  }
  const batchJobs = new Map<string, BatchJob>();

  // Run batch analysis on ALL embedded GSE54650 tissues
  app.post("/api/analyses/batch/all-tissues", async (req, res) => {
    try {
      const { period, threshold } = req.body;
      
      const analysisConfig = {
        period: parseInt(period) || 24,
        threshold: parseFloat(threshold) || 0.05,
        pairs: getAllPairs()
      };
      
      // Get all GSE54650 embedded datasets
      const datasetsDir = path.join(process.cwd(), 'datasets');
      const files = fs.readdirSync(datasetsDir)
        .filter(f => f.endsWith('.csv') && f.startsWith('GSE54650'));
      
      if (files.length === 0) {
        return res.status(404).json({ error: "No embedded datasets found" });
      }
      
      // Create batch job
      const batchId = `batch-${Date.now()}`;
      const batchJob: BatchJob = {
        id: batchId,
        status: 'running',
        totalTissues: files.length,
        completedTissues: 0,
        currentTissue: '',
        results: [],
        startedAt: new Date()
      };
      batchJobs.set(batchId, batchJob);
      
      // Process all tissues sequentially in background
      setImmediate(async () => {
        try {
          for (const filename of files) {
            const datasetId = filename.replace('.csv', '');
            const tissue = datasetId.replace('GSE54650_', '').replace('_circadian', '').replace(/_/g, ' ');
            
            batchJob.currentTissue = tissue;
            console.log(`[Batch ${batchId}] Processing ${tissue} (${batchJob.completedTissues + 1}/${files.length})`);
            
            const filepath = path.join(datasetsDir, filename);
            
            // Create analysis run
            const run = await storage.createAnalysisRun({
              name: `Batch Analysis - ${tissue}`,
              datasetName: filename,
              status: "running"
            });
            
            try {
              const buffer = fs.readFileSync(filepath);
              const parsedData = await parseDatasetBuffer(buffer, filename);
              
              const par2Config: PAR2Config = {
                period: analysisConfig.period,
                significanceThreshold: analysisConfig.threshold
              };
              
              const hypothesesToInsert = [];
              
              for (const pair of analysisConfig.pairs) {
                const targetGene = CANDIDATES.find(c => c.name === pair.target);
                const clockGene = CLOCKS.find(c => c.name === pair.clock);
                
                if (!targetGene || !clockGene) continue;
                
                const targetValues = findGeneData(parsedData, targetGene);
                const clockValues = findGeneData(parsedData, clockGene);
                
                const hasTargetData = targetValues && targetValues.length > 0 && targetValues.some(v => v !== 0);
                const hasClockData = clockValues && clockValues.length > 0 && clockValues.some(v => v !== 0);
                
                let result: { significant: boolean; pValue: number; significantTerms: string[] };
                let geneNotFound = false;
                
                if (hasTargetData && hasClockData) {
                  const targetData: GeneData = { time: parsedData.timepoints, expression: targetValues! };
                  const clockData: GeneData = { time: parsedData.timepoints, expression: clockValues! };
                  result = runPAR2Analysis(targetData, clockData, par2Config);
                  
                  // Apply within-pair Bonferroni correction (×4 for 4 interaction terms)
                  result.pValue = applyWithinPairBonferroni(result.pValue);
                } else {
                  geneNotFound = true;
                  result = { significant: false, pValue: 1.0, significantTerms: [] };
                }
                
                // Re-evaluate significance after Bonferroni correction
                const isSignificant = result.pValue < analysisConfig.threshold;
                
                hypothesesToInsert.push({
                  runId: run.id,
                  targetGene: targetGene.name,
                  targetRole: targetGene.role,
                  clockGene: clockGene.name,
                  clockRole: clockGene.role,
                  significant: isSignificant,
                  pValue: result.pValue,
                  significantTerms: result.significantTerms,
                  description: geneNotFound 
                    ? `Gene data not available in dataset`
                    : isSignificant
                      ? `Significant Phase-Gating found! ${clockGene.name} modulates ${targetGene.name} expression timing.`
                      : `No significant modulation detected (P-value: ${result.pValue.toFixed(4)})`,
                  effectSizeCohensF2: (result as any).effectSize?.cohensF2 ?? null,
                  effectSizeInterpretation: (result as any).effectSize?.cohensF2Interpretation ?? null,
                  rSquaredChange: (result as any).effectSize?.rSquaredChange ?? null,
                  confidenceIntervals: (result as any).confidenceIntervals ?? null
                });
              }
              
              await storage.bulkCreateHypotheses(hypothesesToInsert);
              
              // Apply FDR correction across all pairs in this run
              const fdrResult = await applyFDRCorrectionToRun(run.id, analysisConfig.threshold);
              
              await storage.updateAnalysisRunStatus(run.id, "completed", new Date());
              
              const significantCount = hypothesesToInsert.filter(h => h.significant).length;
              batchJob.results.push({
                tissue,
                runId: run.id,
                significantCount,
                significantAfterFDR: fdrResult.significantAfterFDR,
                totalPairs: hypothesesToInsert.length
              });
              
              console.log(`[Batch ${batchId}] ${tissue}: ${significantCount} Bonf, ${fdrResult.significantAfterFDR} FDR / ${hypothesesToInsert.length} pairs`);
              
            } catch (tissueError) {
              console.error(`[Batch ${batchId}] Error processing ${tissue}:`, tissueError);
              await storage.updateAnalysisRunStatus(run.id, "failed");
              batchJob.results.push({ tissue, runId: run.id, significantCount: 0, totalPairs: 0 });
            }
            
            batchJob.completedTissues++;
          }
          
          batchJob.status = 'completed';
          batchJob.completedAt = new Date();
          batchJob.currentTissue = '';
          console.log(`[Batch ${batchId}] Completed all ${files.length} tissues`);
          
        } catch (error) {
          console.error(`[Batch ${batchId}] Fatal error:`, error);
          batchJob.status = 'failed';
          batchJob.error = String(error);
        }
      });
      
      res.json({ 
        batchId,
        message: `Batch analysis started for ${files.length} tissues with ${analysisConfig.pairs.length} pairs each`,
        totalTests: files.length * analysisConfig.pairs.length
      });
      
    } catch (error) {
      console.error("Error starting batch analysis:", error);
      res.status(500).json({ error: "Failed to start batch analysis" });
    }
  });

  // Get batch job status
  app.get("/api/analyses/batch/:batchId", (req, res) => {
    const job = batchJobs.get(req.params.batchId);
    if (!job) {
      return res.status(404).json({ error: "Batch job not found" });
    }
    res.json(job);
  });

  // Run batch analysis on all independent HUMAN datasets for Cross-Condition Comparison
  app.post("/api/analyses/batch/human-datasets", async (req, res) => {
    try {
      const { period, threshold } = req.body;

      // Nurses datasets (GSE122541) excluded — only 8 timepoints, insufficient power for PAR(2) significance testing
      const HUMAN_DATASETS = [
        { file: "GSE39445_Blood_SufficientSleep_circadian.csv",   label: "Human Blood — Sufficient Sleep (GSE39445)" },
        { file: "GSE39445_Blood_SleepRestriction_circadian.csv",  label: "Human Blood — Sleep Restriction (GSE39445)" },
        { file: "GSE113883_Human_WholeBlood.csv",            label: "Human Whole Blood Circadian (GSE113883)" },
      ];

      const datasetsDir = path.join(process.cwd(), 'datasets');
      const available = HUMAN_DATASETS.filter(d => fs.existsSync(path.join(datasetsDir, d.file)));

      if (available.length === 0) {
        return res.status(404).json({ error: "No human datasets found in datasets/ directory" });
      }

      const analysisConfig = {
        period: parseInt(period) || 24,
        threshold: parseFloat(threshold) || 0.05,
      };

      const batchId = `human-${Date.now()}`;
      const batchJob: BatchJob = {
        id: batchId,
        status: 'running',
        totalTissues: available.length,
        completedTissues: 0,
        currentTissue: '',
        results: [],
        startedAt: new Date()
      };
      batchJobs.set(batchId, batchJob);

      setImmediate(async () => {
        try {
          for (const dataset of available) {
            const datasetId = dataset.file.replace('.csv', '');
            batchJob.currentTissue = dataset.label;
            console.log(`[HumanBatch ${batchId}] Processing ${dataset.label}`);

            const filepath = path.join(datasetsDir, dataset.file);
            const run = await storage.createAnalysisRun({
              name: dataset.label,
              datasetName: dataset.file,
              status: "running"
            });

            try {
              const buffer = fs.readFileSync(filepath);
              const parsedData = await parseDatasetBuffer(buffer, dataset.file);
              console.log(`[HumanBatch] ${dataset.file}: ${parsedData.geneIds.length} genes, ${parsedData.timepoints.length} timepoints`);

              const par2Config: PAR2Config = {
                period: analysisConfig.period,
                significanceThreshold: analysisConfig.threshold
              };

              const pairs = getAllPairs(datasetId);
              const clocks = getClocksForDataset(datasetId);
              const targets = getTargetsForDataset(datasetId);
              const hypothesesToInsert = [];

              for (const pair of pairs) {
                const targetGene = targets.find(c => c.name === pair.target);
                const clockGene = clocks.find(c => c.name === pair.clock);
                if (!targetGene || !clockGene) continue;

                const targetValues = findGeneData(parsedData, targetGene);
                const clockValues = findGeneData(parsedData, clockGene);

                const hasTargetData = targetValues && targetValues.length > 0 && targetValues.some(v => v !== 0);
                const hasClockData = clockValues && clockValues.length > 0 && clockValues.some(v => v !== 0);

                let result: PAR2Result;
                let geneNotFound = false;

                if (hasTargetData && hasClockData) {
                  const targetData: GeneData = { time: parsedData.timepoints, expression: targetValues! };
                  const clockData: GeneData = { time: parsedData.timepoints, expression: clockValues! };
                  result = runPAR2Analysis(targetData, clockData, par2Config);
                  result.pValue = applyWithinPairBonferroni(result.pValue);
                } else {
                  geneNotFound = true;
                  result = { significant: false, pValue: 1.0, significantTerms: [] } as PAR2Result;
                }

                const isSignificant = result.pValue < analysisConfig.threshold;
                hypothesesToInsert.push({
                  runId: run.id,
                  targetGene: targetGene.name,
                  targetRole: targetGene.role,
                  clockGene: clockGene.name,
                  clockRole: clockGene.role,
                  significant: isSignificant,
                  pValue: result.pValue,
                  significantTerms: result.significantTerms || [],
                  description: geneNotFound
                    ? `Gene data not available in dataset`
                    : isSignificant
                      ? `Significant Phase-Gating: ${clockGene.name} modulates ${targetGene.name} timing.`
                      : `No significant modulation (p=${result.pValue.toFixed(4)})`,
                  effectSizeCohensF2: (result as any).effectSize?.cohensF2 ?? null,
                  effectSizeInterpretation: (result as any).effectSize?.cohensF2Interpretation ?? null,
                  rSquaredChange: (result as any).effectSize?.rSquaredChange ?? null,
                  confidenceIntervals: (result as any).confidenceIntervals ?? null
                });
              }

              await storage.bulkCreateHypotheses(hypothesesToInsert);
              const fdrResult = await applyFDRCorrectionToRun(run.id, analysisConfig.threshold);
              await storage.updateAnalysisRunStatus(run.id, "completed", new Date());

              const significantCount = hypothesesToInsert.filter(h => h.significant).length;
              batchJob.results.push({
                tissue: dataset.label,
                runId: run.id,
                significantCount,
                significantAfterFDR: fdrResult.significantAfterFDR,
                totalPairs: hypothesesToInsert.length
              });
              console.log(`[HumanBatch] ${dataset.label}: ${significantCount} sig, ${fdrResult.significantAfterFDR} FDR / ${hypothesesToInsert.length} pairs`);

            } catch (datasetError) {
              console.error(`[HumanBatch] Error processing ${dataset.label}:`, datasetError);
              await storage.updateAnalysisRunStatus(run.id, "failed");
              batchJob.results.push({ tissue: dataset.label, runId: run.id, significantCount: 0, totalPairs: 0 });
            }

            batchJob.completedTissues++;
          }

          batchJob.status = 'completed';
          batchJob.completedAt = new Date();
          batchJob.currentTissue = '';
          console.log(`[HumanBatch ${batchId}] All ${available.length} datasets complete`);

        } catch (error) {
          console.error(`[HumanBatch ${batchId}] Fatal error:`, error);
          batchJob.status = 'failed';
          batchJob.error = String(error);
        }
      });

      res.json({
        batchId,
        message: `Human dataset batch started: ${available.length} datasets, ${getAllPairs().length} gene pairs each`,
        datasets: available.map(d => d.label),
        totalTests: available.length * getAllPairs().length
      });

    } catch (error) {
      console.error("Error starting human batch analysis:", error);
      res.status(500).json({ error: "Failed to start human batch analysis" });
    }
  });

  // Run batch analysis on ALL GSE157357 organoid conditions
  app.post("/api/analyses/batch/all-organoids", async (req, res) => {
    try {
      const { period, threshold } = req.body;
      
      const analysisConfig = {
        period: parseInt(period) || 24,
        threshold: parseFloat(threshold) || 0.05,
        pairs: getAllPairs()
      };
      
      // Get all GSE157357 organoid datasets
      const datasetsDir = path.join(process.cwd(), 'datasets');
      const files = fs.readdirSync(datasetsDir)
        .filter(f => f.endsWith('.csv') && f.startsWith('GSE157357'));
      
      if (files.length === 0) {
        return res.status(404).json({ error: "No organoid datasets found" });
      }
      
      // Condition labels for display
      const conditionLabels: Record<string, string> = {
        'WT-WT': 'WT/WT',
        'WT-BmalKO': 'WT/BMAL1-KO',
        'ApcKO-WT': 'APC-KO/WT',
        'ApcKO-BmalKO': 'APC-KO/BMAL1-KO'
      };
      
      // Create batch job
      const batchId = `organoid-batch-${Date.now()}`;
      const batchJob: BatchJob = {
        id: batchId,
        status: 'running',
        totalTissues: files.length,
        completedTissues: 0,
        currentTissue: '',
        results: [],
        startedAt: new Date()
      };
      batchJobs.set(batchId, batchJob);
      
      // Process all organoid conditions sequentially in background
      setImmediate(async () => {
        try {
          for (const filename of files) {
            const datasetId = filename.replace('.csv', '');
            const conditionMatch = filename.match(/GSE157357_Organoid_(.+)_circadian\.csv$/);
            const condition = conditionMatch ? conditionMatch[1] : 'Unknown';
            const displayName = conditionLabels[condition] || condition;
            
            batchJob.currentTissue = displayName;
            console.log(`[Organoid Batch ${batchId}] Processing ${displayName} (${batchJob.completedTissues + 1}/${files.length})`);
            
            const filepath = path.join(datasetsDir, filename);
            
            // Create analysis run
            const run = await storage.createAnalysisRun({
              name: `Organoid Batch - ${displayName}`,
              datasetName: filename,
              status: "running"
            });
            
            try {
              const buffer = fs.readFileSync(filepath);
              const parsedData = await parseDatasetBuffer(buffer, filename);
              
              const par2Config: PAR2Config = {
                period: analysisConfig.period,
                significanceThreshold: analysisConfig.threshold
              };
              
              const hypothesesToInsert = [];
              
              for (const pair of analysisConfig.pairs) {
                const targetGene = CANDIDATES.find(c => c.name === pair.target);
                const clockGene = CLOCKS.find(c => c.name === pair.clock);
                
                if (!targetGene || !clockGene) continue;
                
                const targetValues = findGeneData(parsedData, targetGene);
                const clockValues = findGeneData(parsedData, clockGene);
                
                const hasTargetData = targetValues && targetValues.length > 0 && targetValues.some(v => v !== 0);
                const hasClockData = clockValues && clockValues.length > 0 && clockValues.some(v => v !== 0);
                
                let result: { significant: boolean; pValue: number; significantTerms: string[] };
                let geneNotFound = false;
                
                if (hasTargetData && hasClockData) {
                  const targetData: GeneData = { time: parsedData.timepoints, expression: targetValues! };
                  const clockData: GeneData = { time: parsedData.timepoints, expression: clockValues! };
                  result = runPAR2Analysis(targetData, clockData, par2Config);
                  
                  // Apply within-pair Bonferroni correction (×4 for 4 interaction terms)
                  result.pValue = applyWithinPairBonferroni(result.pValue);
                } else {
                  geneNotFound = true;
                  result = { significant: false, pValue: 1.0, significantTerms: [] };
                }
                
                // Re-evaluate significance after Bonferroni correction
                const isSignificant = result.pValue < analysisConfig.threshold;
                
                hypothesesToInsert.push({
                  runId: run.id,
                  targetGene: targetGene.name,
                  targetRole: targetGene.role,
                  clockGene: clockGene.name,
                  clockRole: clockGene.role,
                  significant: isSignificant,
                  pValue: result.pValue,
                  significantTerms: result.significantTerms,
                  description: geneNotFound 
                    ? `Gene data not available in dataset`
                    : isSignificant
                      ? `Significant Phase-Gating found! ${clockGene.name} modulates ${targetGene.name} expression timing.`
                      : `No significant modulation detected (P-value: ${result.pValue.toFixed(4)})`,
                  effectSizeCohensF2: (result as any).effectSize?.cohensF2 ?? null,
                  effectSizeInterpretation: (result as any).effectSize?.cohensF2Interpretation ?? null,
                  rSquaredChange: (result as any).effectSize?.rSquaredChange ?? null,
                  confidenceIntervals: (result as any).confidenceIntervals ?? null
                });
              }
              
              await storage.bulkCreateHypotheses(hypothesesToInsert);
              
              // Apply FDR correction across all pairs in this run
              const fdrResult = await applyFDRCorrectionToRun(run.id, analysisConfig.threshold);
              
              await storage.updateAnalysisRunStatus(run.id, "completed", new Date());
              
              // Save WT-WT results to JSON file so organoid comparison endpoints can use them
              if (condition === 'WT-WT') {
                try {
                  const wtResultsPath = path.join(datasetsDir, 'WT_152pair_results.json');
                  const wtJson = {
                    results: hypothesesToInsert.map(h => ({
                      clockGene: h.clockGene,
                      targetGene: h.targetGene,
                      significant: h.significant,
                      pValue: h.pValue,
                      significantTerms: h.significantTerms
                    })),
                    metadata: {
                      pairsTested: hypothesesToInsert.length,
                      pairsSignificant: hypothesesToInsert.filter(h => h.significant).length,
                      generatedAt: new Date().toISOString(),
                      dataset: 'GSE157357_Organoid_WT-WT_circadian.csv'
                    }
                  };
                  fs.writeFileSync(wtResultsPath, JSON.stringify(wtJson, null, 2));
                  console.log(`[Organoid Batch ${batchId}] Saved WT-WT results to WT_152pair_results.json`);
                } catch (saveError) {
                  console.error(`[Organoid Batch ${batchId}] Failed to save WT-WT results:`, saveError);
                }
              }

              const significantCount = hypothesesToInsert.filter(h => h.significant).length;
              batchJob.results.push({
                tissue: displayName,
                runId: run.id,
                significantCount,
                significantAfterFDR: fdrResult.significantAfterFDR,
                totalPairs: hypothesesToInsert.length
              });
              
              console.log(`[Organoid Batch ${batchId}] ${displayName}: ${significantCount} Bonf, ${fdrResult.significantAfterFDR} FDR / ${hypothesesToInsert.length} pairs`);
              
            } catch (conditionError) {
              console.error(`[Organoid Batch ${batchId}] Error processing ${displayName}:`, conditionError);
              await storage.updateAnalysisRunStatus(run.id, "failed");
              batchJob.results.push({ tissue: displayName, runId: run.id, significantCount: 0, totalPairs: 0 });
            }
            
            batchJob.completedTissues++;
          }
          
          batchJob.status = 'completed';
          batchJob.completedAt = new Date();
          batchJob.currentTissue = '';
          console.log(`[Organoid Batch ${batchId}] Completed all ${files.length} conditions`);
          
        } catch (error) {
          console.error(`[Organoid Batch ${batchId}] Fatal error:`, error);
          batchJob.status = 'failed';
          batchJob.error = String(error);
        }
      });
      
      res.json({ 
        batchId,
        message: `Organoid batch analysis started for ${files.length} conditions with ${analysisConfig.pairs.length} pairs each`,
        totalTests: files.length * analysisConfig.pairs.length
      });
      
    } catch (error) {
      console.error("Error starting organoid batch analysis:", error);
      res.status(500).json({ error: "Failed to start organoid batch analysis" });
    }
  });

  // Get cross-tissue comparison report from in-memory batch job
  app.get("/api/analyses/batch/:batchId/report", async (req, res) => {
    const batchId = req.params.batchId;
    
    // Handle "latest" by generating report from database
    if (batchId === 'latest') {
      return generateCrossTissueReportFromDB(res);
    }
    
    const job = batchJobs.get(batchId);
    if (!job) {
      // Fallback to database-based report
      return generateCrossTissueReportFromDB(res);
    }
    
    if (job.status !== 'completed') {
      return res.status(400).json({ error: "Batch job not yet completed", status: job.status });
    }
    
    try {
      // Build cross-tissue comparison matrix
      const pairMatrix: Record<string, Record<string, { significant: boolean; pValue: number }>> = {};
      const tissueData: Record<string, any[]> = {};
      
      for (const result of job.results) {
        const hypotheses = await storage.getHypothesesByRunId(result.runId);
        tissueData[result.tissue] = hypotheses;
        
        for (const h of hypotheses) {
          const pairKey = `${h.clockGene}→${h.targetGene}`;
          if (!pairMatrix[pairKey]) pairMatrix[pairKey] = {};
          pairMatrix[pairKey][result.tissue] = { significant: h.significant, pValue: h.pValue ?? 1.0 };
        }
      }
      
      // Identify conserved vs tissue-specific relationships
      const conserved: string[] = [];
      const tissueSpecific: Record<string, string[]> = {};
      
      for (const [pair, tissues] of Object.entries(pairMatrix)) {
        const significantTissues = Object.entries(tissues)
          .filter(([_, data]) => data.significant)
          .map(([tissue]) => tissue);
        
        if (significantTissues.length >= 6) {
          conserved.push(pair);
        } else if (significantTissues.length > 0 && significantTissues.length <= 2) {
          for (const tissue of significantTissues) {
            if (!tissueSpecific[tissue]) tissueSpecific[tissue] = [];
            tissueSpecific[tissue].push(pair);
          }
        }
      }
      
      res.json({
        batchId: job.id,
        completedAt: job.completedAt,
        summary: {
          totalTissues: job.totalTissues,
          totalTests: job.results.reduce((sum, r) => sum + r.totalPairs, 0),
          totalSignificant: job.results.reduce((sum, r) => sum + r.significantCount, 0)
        },
        tissueResults: job.results,
        conservedRelationships: conserved,
        tissueSpecificRelationships: tissueSpecific,
        pairMatrix
      });
      
    } catch (error) {
      console.error("Error generating batch report:", error);
      res.status(500).json({ error: "Failed to generate report" });
    }
  });
  
  // Helper function to generate cross-tissue report from database
  async function generateCrossTissueReportFromDB(res: any) {
    try {
      const analyses = await storage.getAllAnalysisRuns();
      
      // Get all GSE54650 tissue analyses
      const tissueRuns = analyses.filter(run => 
        run.datasetName.startsWith('GSE54650') && 
        run.datasetName.endsWith('.csv') &&
        run.status === 'completed'
      );
      
      if (tissueRuns.length === 0) {
        return res.status(404).json({ error: "No GSE54650 tissue analyses found. Run batch analysis first." });
      }
      
      // Get the most recent run for each tissue
      const tissueMap = new Map<string, typeof tissueRuns[0]>();
      for (const run of tissueRuns) {
        const tissue = run.datasetName.replace('GSE54650_', '').replace('_circadian.csv', '').replace(/_/g, ' ');
        const existing = tissueMap.get(tissue);
        if (!existing || new Date(run.createdAt) > new Date(existing.createdAt)) {
          tissueMap.set(tissue, run);
        }
      }
      
      // Build cross-tissue comparison matrix
      const pairMatrix: Record<string, Record<string, { significant: boolean; pValue: number }>> = {};
      const tissueResults: Array<{ tissue: string; runId: string; significantCount: number; totalPairs: number }> = [];
      
      for (const [tissue, run] of Array.from(tissueMap.entries())) {
        const hypotheses = await storage.getHypothesesByRunId(run.id);
        
        const significantCount = hypotheses.filter(h => h.significant).length;
        tissueResults.push({
          tissue,
          runId: run.id,
          significantCount,
          totalPairs: hypotheses.length
        });
        
        for (const h of hypotheses) {
          const pairKey = `${h.clockGene}→${h.targetGene}`;
          if (!pairMatrix[pairKey]) pairMatrix[pairKey] = {};
          pairMatrix[pairKey][tissue] = { significant: h.significant, pValue: h.pValue ?? 1.0 };
        }
      }
      
      // Identify conserved vs tissue-specific relationships
      const conserved: string[] = [];
      const tissueSpecific: Record<string, string[]> = {};
      
      for (const [pair, tissues] of Object.entries(pairMatrix)) {
        const significantTissues = Object.entries(tissues)
          .filter(([_, data]) => data.significant)
          .map(([tissue]) => tissue);
        
        if (significantTissues.length >= 6) {
          conserved.push(pair);
        } else if (significantTissues.length > 0 && significantTissues.length <= 2) {
          for (const tissue of significantTissues) {
            if (!tissueSpecific[tissue]) tissueSpecific[tissue] = [];
            tissueSpecific[tissue].push(pair);
          }
        }
      }
      
      res.json({
        batchId: 'from-database',
        generatedAt: new Date().toISOString(),
        summary: {
          totalTissues: tissueMap.size,
          totalTests: tissueResults.reduce((sum, r) => sum + r.totalPairs, 0),
          totalSignificant: tissueResults.reduce((sum, r) => sum + r.significantCount, 0)
        },
        tissueResults,
        conservedRelationships: conserved,
        tissueSpecificRelationships: tissueSpecific,
        pairMatrix
      });
      
    } catch (error) {
      console.error("Error generating cross-tissue report from DB:", error);
      res.status(500).json({ error: "Failed to generate report" });
    }
  }

  // Download formatted cross-tissue report as Markdown
  app.get("/api/download/cross-tissue-report", async (req, res) => {
    try {
      const analyses = await storage.getAllAnalysisRuns();
      
      const tissueRuns = analyses.filter(run => 
        run.datasetName.startsWith('GSE54650') && 
        run.datasetName.endsWith('.csv') &&
        run.status === 'completed'
      );
      
      if (tissueRuns.length === 0) {
        return res.status(404).json({ error: "No GSE54650 tissue analyses found. Run batch analysis first." });
      }
      
      const tissueMap = new Map<string, typeof tissueRuns[0]>();
      for (const run of tissueRuns) {
        const tissue = run.datasetName.replace('GSE54650_', '').replace('_circadian.csv', '').replace(/_/g, ' ');
        const existing = tissueMap.get(tissue);
        if (!existing || new Date(run.createdAt) > new Date(existing.createdAt)) {
          tissueMap.set(tissue, run);
        }
      }
      
      const pairMatrix: Record<string, Record<string, { significant: boolean; pValue: number }>> = {};
      const tissueResults: Array<{ tissue: string; significantCount: number; totalPairs: number; topFindings: string[] }> = [];
      
      for (const [tissue, run] of Array.from(tissueMap.entries())) {
        const hypotheses = await storage.getHypothesesByRunId(run.id);
        const significantHypotheses = hypotheses.filter(h => h.significant);
        const significantCount = significantHypotheses.length;
        const topFindings = significantHypotheses
          .sort((a, b) => (a.pValue ?? 1) - (b.pValue ?? 1))
          .slice(0, 3)
          .map(h => `${h.clockGene}→${h.targetGene} (p=${(h.pValue ?? 1).toFixed(4)})`);
        
        tissueResults.push({ tissue, significantCount, totalPairs: hypotheses.length, topFindings });
        
        for (const h of hypotheses) {
          const pairKey = `${h.clockGene}→${h.targetGene}`;
          if (!pairMatrix[pairKey]) pairMatrix[pairKey] = {};
          pairMatrix[pairKey][tissue] = { significant: h.significant, pValue: h.pValue ?? 1.0 };
        }
      }
      
      const conserved: string[] = [];
      const tissueSpecific: Record<string, string[]> = {};
      
      for (const [pair, tissues] of Object.entries(pairMatrix)) {
        const significantTissues = Object.entries(tissues)
          .filter(([_, data]) => data.significant)
          .map(([tissue]) => tissue);
        
        if (significantTissues.length >= 6) {
          conserved.push(pair);
        } else if (significantTissues.length > 0 && significantTissues.length <= 2) {
          for (const tissue of significantTissues) {
            if (!tissueSpecific[tissue]) tissueSpecific[tissue] = [];
            tissueSpecific[tissue].push(pair);
          }
        }
      }
      
      const totalTests = tissueResults.reduce((sum, r) => sum + r.totalPairs, 0);
      const totalSignificant = tissueResults.reduce((sum, r) => sum + r.significantCount, 0);
      
      const report = `# PAR(2) Cross-Tissue Circadian Gating Analysis Report

## Executive Summary

**Generated:** ${new Date().toLocaleString()}  
**Dataset:** GSE54650 - Hughes Circadian Atlas (Mouse)  
**Study:** PMID 25349387  
**Analysis Method:** PAR(2) Phase-Amplitude-Relationship Regression  
**Significance Threshold:** p < 0.05

---

## Key Findings

- **Tissues Analyzed:** ${tissueResults.length}
- **Total Hypothesis Tests:** ${totalTests.toLocaleString()}
- **Total Significant Discoveries:** ${totalSignificant} (${((totalSignificant / totalTests) * 100).toFixed(1)}%)

### Conserved Circadian Gating Relationships (≥6 tissues)

${conserved.length > 0 ? conserved.map(pair => `- **${pair}**`).join('\n') : 'No relationships conserved across ≥6 tissues detected.'}

---

## Tissue-by-Tissue Results

${tissueResults.sort((a, b) => b.significantCount - a.significantCount).map(r => `
### ${r.tissue}
- **Significant Findings:** ${r.significantCount}/${r.totalPairs} (${((r.significantCount / r.totalPairs) * 100).toFixed(1)}%)
${r.topFindings.length > 0 ? `- **Top 3 Discoveries:** ${r.topFindings.join(', ')}` : '- No significant findings'}
`).join('\n')}

---

## Tissue-Specific Relationships

These clock-gene interactions are significant in only 1-2 tissues, suggesting tissue-specific circadian regulation:

${Object.entries(tissueSpecific).length > 0 
  ? Object.entries(tissueSpecific).map(([tissue, pairs]) => 
    `### ${tissue}\n${pairs.slice(0, 5).map(p => `- ${p}`).join('\n')}${pairs.length > 5 ? `\n- *(${pairs.length - 5} more...)*` : ''}`
  ).join('\n\n')
  : 'No tissue-specific relationships detected (all findings present in 3+ tissues).'}

---

## Biological Interpretation

The PAR(2) model tests whether circadian clock genes (Per1, Per2, Cry1, Cry2, Clock, Arntl, Nr1d1, Nr1d2) modulate the expression timing of cancer-related target genes across the 24-hour cycle.

**Conserved relationships** (significant in ≥6 tissues) represent fundamental circadian regulatory mechanisms that may be important for:
- Systemic timing of cell proliferation
- Coordinated metabolic rhythms
- Universal DNA repair timing

**Tissue-specific relationships** suggest specialized circadian control relevant to:
- Tissue-specific tumor susceptibility windows
- Chronotherapy optimization for different cancer types
- Understanding why certain cancers show tissue-specific circadian disruption

---

## Methods

The PAR(2) model includes:
- Autoregressive terms: R(n-1), R(n-2) for temporal dynamics
- Phase interaction terms: R×cos(φ), R×sin(φ) to detect phase-dependent modulation
- Statistical significance determined by F-test on phase interaction coefficients

**References:**
1. Hughes ME, et al. (2009). Harmonics of Circadian Gene Transcription in Mammals. PLoS Genet.
2. Zhang R, et al. (2014). A circadian gene expression atlas in mammals. PNAS.

---

*Report generated by PAR(2) Discovery Engine*
*https://github.com/yourusername/par2-discovery-engine*
`;
      
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename=PAR2_Cross_Tissue_Report_${new Date().toISOString().split('T')[0]}.md`);
      res.send(report);
      
    } catch (error) {
      console.error("Error generating cross-tissue report:", error);
      res.status(500).json({ error: "Failed to generate report" });
    }
  });

  app.get("/api/download/user-guide", async (req, res) => {
    try {
      const filePath = path.join(process.cwd(), 'manuscripts', 'PAR2_User_Guide.html');
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf-8');
        res.setHeader('Content-Type', 'text/html');
        res.setHeader('Content-Disposition', 'attachment; filename=PAR2_Discovery_Engine_User_Guide.html');
        res.send(content);
      } else {
        res.status(404).json({ error: "User guide not found" });
      }
    } catch (error) {
      console.error("Error downloading user guide:", error);
      res.status(500).json({ error: "Failed to download user guide" });
    }
  });

  // Download the platform overview (for AI analysis)
  app.get("/api/download/platform-overview", async (req, res) => {
    try {
      // README.md is the public overview; replit.md is internal working notes
      // that are not part of the deployment.
      const filePath = path.join(process.cwd(), 'README.md');
      if (!fs.existsSync(filePath)) {
        res.status(404).json({ error: "Platform overview is not available on this deployment." });
        return;
      }
      const content = fs.readFileSync(filePath, 'utf-8');
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename=PAR2_Platform_Overview.md');
      res.send(content);
    } catch (error) {
      res.status(500).json({ error: "Failed to download platform overview" });
    }
  });

  // Download cross-tissue manuscript as LaTeX (password protected - contains methodology)
  app.get("/api/download/cross-tissue-manuscript", async (req, res) => {
    const auth = verifyDownloadPassword(req);
    if (!auth.valid) {
      return res.status(401).json({ error: auth.error });
    }
    
    try {
      const filePath = path.join(process.cwd(), 'manuscripts', 'cross_tissue_circadian_gating_manuscript.tex');
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf-8');
        res.setHeader('Content-Type', 'application/x-tex');
        res.setHeader('Content-Disposition', 'attachment; filename=PAR2_Cross_Tissue_Circadian_Gating_Manuscript.tex');
        res.send(content);
      } else {
        res.status(404).json({ error: "Manuscript file not found" });
      }
    } catch (error) {
      console.error("Error downloading manuscript:", error);
      res.status(500).json({ error: "Failed to download manuscript" });
    }
  });

  // Download supplementary data as CSV
  app.get("/api/download/supplementary-data", async (req, res) => {
    try {
      // Try multiple possible locations for supplementary data
      const possiblePaths = [
        path.join(process.cwd(), 'manuscripts', 'supplementary', 'PAR2_Complete_Results.csv'),
        path.join(process.cwd(), 'manuscripts', 'supplementary_data_complete.csv'),
        path.join(process.cwd(), 'manuscripts', 'supplementary_tables_complete.csv')
      ];
      
      let filePath = null;
      for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
          filePath = p;
          break;
        }
      }
      
      if (filePath) {
        const content = fs.readFileSync(filePath, 'utf-8');
        const filename = generateAuditFilename('PAR2_Supplementary_Data', 'csv');
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
        res.send(content);
      } else {
        res.status(404).json({ error: "Supplementary data file not found" });
      }
    } catch (error) {
      console.error("Error downloading supplementary data:", error);
      res.status(500).json({ error: "Failed to download supplementary data" });
    }
  });

  // Download all proteomics results as CSV
  app.get("/api/download/proteomics-complete", async (req, res) => {
    try {
      const filePath = path.join(process.cwd(), 'manuscripts', 'supplementary', 'S2_Proteomics_PAR2_Results.csv');
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf-8');
        const filename = generateAuditFilename('PAR2_Proteomics_Results_Complete', 'csv');
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
        res.send(content);
      } else {
        res.status(404).json({ error: "Proteomics data file not found" });
      }
    } catch (error) {
      console.error("Error downloading proteomics data:", error);
      res.status(500).json({ error: "Failed to download proteomics data" });
    }
  });

  // Download tissue vs organoid comparison report
  app.get("/api/download/tissue-vs-organoid-report", async (req, res) => {
    try {
      // Load tissue results
      const analyses = await storage.getAllAnalysisRuns();
      const tissueRuns = analyses.filter(run => 
        run.datasetName.startsWith('GSE54650') && 
        run.datasetName.endsWith('.csv') &&
        run.status === 'completed'
      );
      
      // Load organoid results
      const wtResultsPath = path.join(process.cwd(), 'datasets', 'WT_152pair_results.json');
      const organoidResults = JSON.parse(fs.readFileSync(wtResultsPath, 'utf-8'));
      
      const tissueFindings: Record<string, string[]> = {};
      for (const run of tissueRuns) {
        const tissue = run.datasetName.replace('GSE54650_', '').replace('_circadian.csv', '').replace(/_/g, ' ');
        const hypotheses = await storage.getHypothesesByRunId(run.id);
        tissueFindings[tissue] = hypotheses.filter(h => h.significant).map(h => `${h.clockGene}→${h.targetGene}`);
      }
      
      const organoidSignificant = organoidResults.results
        .filter((r: any) => r.significant)
        .map((r: any) => ({ pair: `${r.clockGene}→${r.targetGene}`, pValue: r.pValue }));
      
      const allTissueSignificant = new Set<string>();
      Object.values(tissueFindings).forEach(pairs => pairs.forEach(p => allTissueSignificant.add(p)));
      
      const conserved = organoidSignificant.filter((o: any) => allTissueSignificant.has(o.pair));
      
      const report = `# PAR(2) Tissue vs Organoid Comparison Report

## Executive Summary

**Generated:** ${new Date().toISOString()}  
**Analysis:** In Vivo Tissues (GSE54650) vs In Vitro Organoids (GSE157357)  
**Method:** PAR(2) Phase-Amplitude-Relationship Regression

---

## Key Comparison

| System | Dataset | Samples | Significant Findings |
|--------|---------|---------|---------------------|
| **Whole Tissues** | GSE54650 (Hughes Atlas) | ${Object.keys(tissueFindings).length} tissues | ${Array.from(allTissueSignificant).length} unique pairs |
| **Intestinal Organoids** | GSE157357 | Wild-Type | ${organoidSignificant.length} pairs |

---

## Conserved Gating Relationships

Circadian gating relationships found in **BOTH** whole tissues and organoids:

${conserved.length > 0 ? conserved.map((c: any) => `- **${c.pair}** (organoid p=${c.pValue.toFixed(4)})`).join('\n') : '- *No conserved relationships found*'}

---

## Organoid-Specific Findings

Gating relationships unique to intestinal organoids (not found in whole tissues):

${organoidSignificant.filter((o: any) => !allTissueSignificant.has(o.pair)).map((o: any) => `- ${o.pair} (p=${o.pValue.toFixed(4)})`).join('\n') || '- None'}

---

## Top Tissue-Specific Findings

Gating relationships found in tissues but NOT in organoids:

${Array.from(allTissueSignificant).filter(p => !organoidSignificant.some((o: any) => o.pair === p)).slice(0, 15).map(p => `- ${p}`).join('\n') || '- None'}

---

## Scientific Interpretation

### Why Results May Differ

1. **Systemic vs Cell-Autonomous**: Whole tissues receive hormonal, neural, and immune signals that modulate circadian gating. Organoids lack these systemic inputs.

2. **Tissue Complexity**: Tissues contain multiple cell types with distinct circadian programs. Organoids represent a more homogeneous epithelial population.

3. **Wnt Pathway Focus**: GSE157357 organoids were derived from intestinal crypts where Wnt signaling is dominant, potentially enriching for Wnt/stem cell circadian interactions.

### Recommendations

- **For Mechanism Studies**: Use organoids to identify cell-autonomous clock-cancer interactions
- **For Physiological Relevance**: Validate organoid findings in corresponding tissues
- **For Chronotherapy**: Prioritize conserved relationships that appear in both systems

---

## Methods Note

**In Vivo (GSE54650):** Mouse tissues sampled every 2 hours, CT18-CT64 (Hughes Circadian Atlas)  
**In Vitro (GSE157357):** Mouse intestinal organoids with controlled entrainment

Both datasets analyzed using identical PAR(2) framework with p<0.05 significance threshold.

---

*Report generated by PAR(2) Discovery Engine*
`;
      
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename=PAR2_Tissue_vs_Organoid_Comparison_${new Date().toISOString().split('T')[0]}.md`);
      res.send(report);
    } catch (error) {
      console.error("Error generating comparison report:", error);
      res.status(500).json({ error: "Failed to generate comparison report" });
    }
  });

  // Get configuration (genes and default pairs)
  // Accepts optional dataset query param to return organism-specific gene lists
  app.get("/api/config", (req, res) => {
    const dataset = req.query.dataset as string | undefined;
    const organism = dataset ? detectOrganism(dataset) : 'mouse';
    
    if (organism === 'plant') {
      res.json({
        candidates: ARABIDOPSIS_TARGETS,
        clocks: ARABIDOPSIS_CLOCKS,
        pairs: getDefaultPairs(dataset),
        organism: 'plant'
      });
    } else {
      res.json({
        candidates: CANDIDATES,
        clocks: CLOCKS,
        pairs: DEFAULT_PAIRS,
        organism: organism
      });
    }
  });

  // Download findings report
  app.get("/api/download/report", async (req, res) => {
    try {
      const analyses = await storage.getAllAnalysisRuns();
      
      // Build comprehensive report from all analyses
      const conditionResults: any[] = [];
      
      for (const run of analyses) {
        if (run.datasetName.includes('GSE157357') && run.status === 'completed') {
          const result = await storage.getAnalysisRunWithHypotheses(run.id);
          if (result && result.hypotheses.length > 0) {
            conditionResults.push({
              name: run.datasetName,
              date: run.createdAt,
              hypotheses: result.hypotheses
            });
          }
        }
      }

      // Generate markdown report
      let report = `# PAR(2) Discovery Engine - Complete Analysis Summary

**Generated:** ${new Date().toLocaleDateString()}
**Dataset:** GSE157357 - Mouse Intestinal Organoids
**Analysis Method:** PAR(2) Phase-Amplitude-Relationship Regression
**Significance Threshold:** p < 0.05

---

## Executive Summary

This analysis tested whether circadian clock genes (Per2, Arntl/BMAL1) act as "gatekeepers" controlling the timing of cancer-related gene expression in mouse intestinal organoids.

---

## Results by Condition

`;

      for (const condition of conditionResults) {
        const significant = condition.hypotheses.filter((h: any) => h.significant);
        
        report += `### ${condition.name}

| Target Gene | Clock Gene | P-value | Significant | Interpretation |
|-------------|------------|---------|-------------|----------------|
`;
        for (const h of condition.hypotheses) {
          const pVal = h.pValue === 1 ? 'N/A' : h.pValue.toFixed(4);
          const sig = h.significant ? '**YES**' : 'No';
          report += `| ${h.targetGene} | ${h.clockGene} | ${pVal} | ${sig} | ${h.description} |\n`;
        }
        
        report += `\n**Significant findings:** ${significant.length} of ${condition.hypotheses.length}\n\n---\n\n`;
      }

      report += `
## Key Findings

1. **Lgr5** (stem cell marker) shows significant circadian phase-gating by Per2 (p = 0.0115) in BMAL1-mutant conditions
2. **APC mutation** disrupts ALL circadian-cancer gene relationships more severely than BMAL1 mutation
3. **Per2** can function independently of BMAL1 for regulating stem cell genes

## Methods

The PAR(2) model tests phase-amplitude relationships:
\`\`\`
Y(t) = β₀ + β₁·Y(t-1) + β₂·Y(t-2) + phase_interaction_terms + ε
\`\`\`

F-statistic tests whether clock gene phase significantly modulates target gene expression timing.

---
*Generated by PAR(2) Discovery Engine*
`;

      res.setHeader('Content-Type', 'text/markdown');
      res.setHeader('Content-Disposition', 'attachment; filename="PAR2_Findings_Report.md"');
      res.send(report);
    } catch (error) {
      console.error("Error generating report:", error);
      res.status(500).json({ error: "Failed to generate report" });
    }
  });

  // Download findings as JSON
  app.get("/api/download/data", async (req, res) => {
    try {
      const analyses = await storage.getAllAnalysisRuns();
      const results: any[] = [];
      
      for (const run of analyses) {
        if (run.status === 'completed') {
          const result = await storage.getAnalysisRunWithHypotheses(run.id);
          if (result) {
            results.push(result);
          }
        }
      }

      const exportData = {
        metadata: {
          generated: new Date().toISOString(),
          dataset: "GSE157357",
          method: "PAR(2) Phase-Amplitude-Relationship Regression",
          significance_threshold: 0.05
        },
        analyses: results
      };

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename="PAR2_Analysis_Data.json"');
      res.json(exportData);
    } catch (error) {
      console.error("Error exporting data:", error);
      res.status(500).json({ error: "Failed to export data" });
    }
  });

  // Download detailed findings with implications
  app.get("/api/download/detailed-findings", async (req, res) => {
    try {
      const filePath = path.join(process.cwd(), 'findings_export', 'DETAILED_FINDINGS_AND_IMPLICATIONS.md');
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf-8');
        res.setHeader('Content-Type', 'text/markdown');
        res.setHeader('Content-Disposition', 'attachment; filename="PAR2_Detailed_Findings_And_Implications.md"');
        res.send(content);
      } else {
        res.status(404).json({ error: "Detailed findings file not found" });
      }
    } catch (error) {
      console.error("Error downloading detailed findings:", error);
      res.status(500).json({ error: "Failed to download detailed findings" });
    }
  });

  // Download complete source code as a single file (PASSWORD PROTECTED)
  app.get("/api/download/source", async (req, res) => {
    const auth = verifyDownloadPassword(req);
    if (!auth.valid) {
      return res.status(401).json({ error: auth.error, requiresPassword: true });
    }
    
    try {
      const sourceFiles = [
        { name: 'server/par2-engine.ts', path: 'server/par2-engine.ts' },
        { name: 'server/routes.ts', path: 'server/routes.ts' },
        { name: 'server/storage.ts', path: 'server/storage.ts' },
        { name: 'server/index.ts', path: 'server/index.ts' },
        { name: 'shared/schema.ts', path: 'shared/schema.ts' },
        { name: 'client/src/pages/dashboard.tsx', path: 'client/src/pages/dashboard.tsx' },
        { name: 'client/src/index.css', path: 'client/src/index.css' },
        { name: 'package.json', path: 'package.json' },
      ];

      let combined = `# PAR(2) Discovery Engine - Complete Source Code
# Generated: ${new Date().toISOString()}
# ============================================

`;

      for (const file of sourceFiles) {
        try {
          const content = fs.readFileSync(file.path, 'utf-8');
          combined += `
${'='.repeat(80)}
FILE: ${file.name}
${'='.repeat(80)}

${content}

`;
        } catch (e) {
          combined += `
${'='.repeat(80)}
FILE: ${file.name} (not found)
${'='.repeat(80)}

`;
        }
      }

      res.setHeader('Content-Type', 'text/plain');
      res.setHeader('Content-Disposition', 'attachment; filename="PAR2_Complete_Source_Code.txt"');
      res.send(combined);
    } catch (error) {
      console.error("Error exporting source:", error);
      res.status(500).json({ error: "Failed to export source code" });
    }
  });

  // Serve diagnostic files (password protected - contains implementation details)
  app.get("/api/download/diagnostic", async (req, res) => {
    const auth = verifyDownloadPassword(req);
    if (!auth.valid) {
      return res.status(401).json({ error: auth.error });
    }
    
    try {
      const filePath = path.join(process.cwd(), 'public', 'diagnostics', 'par2_full_diagnostic.json');
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf-8');
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', 'attachment; filename="PAR2_Full_Diagnostic.json"');
        res.send(content);
      } else {
        res.status(404).json({ error: "Diagnostic file not found. Run a full diagnostic first." });
      }
    } catch (error) {
      console.error("Error serving diagnostic:", error);
      res.status(500).json({ error: "Failed to serve diagnostic file" });
    }
  });

  // Download complete analysis report (public)
  app.get("/api/download/complete-analysis-report", async (req, res) => {
    try {
      const filePath = path.join(process.cwd(), 'docs', 'COMPLETE_ANALYSIS_REPORT.md');
      if (fs.existsSync(filePath)) {
        let content = fs.readFileSync(filePath, 'utf-8');
        const diagnosticsSection = `

---

## Edge Case Diagnostics Reliability Framework

The PAR(2) Discovery Engine includes a 6-point edge case diagnostics framework that evaluates the reliability of every AR(2) eigenvalue estimate. These diagnostics are applied automatically and flag potential issues before interpretation:

1. **Trend Detection (Non-Stationarity):** Computes the normalized linear slope of the input series. Triggers when slope magnitude is large (>3.0 normalized) and eigenvalue is near-critical (|λ| > 0.9). A significant trend may inflate the eigenvalue, making the process appear more persistent than it truly is. Recommendation: detrend before analysis.

2. **Sample-Size Confidence Band:** Estimates the expected eigenvalue estimation error based on sample count. With fewer than 50 samples, the confidence band widens significantly (±0.10 to ±0.25). Triggers as a warning when n < 50 and critical when n < 25. Reported eigenvalues should be interpreted within these uncertainty bounds.

3. **AR(3) Model Order Check:** Fits an AR(3) model and compares AIC and R² against the AR(2) fit. Triggers when AR(3) provides a meaningfully better fit (ΔAIC > 2 and ΔR² > 0.02), suggesting the signal may have 3rd-order memory that the AR(2) model misses. Does not invalidate AR(2) results but suggests caution.

4. **Non-Linearity Test:** Examines residual skewness and excess kurtosis. Triggers when |skewness| > 1.0 or |excess kurtosis| > 3.0, indicating the signal has nonlinear dynamics (sudden spikes, arrhythmia) that the linear AR(2) model cannot capture. Eigenvalue interpretation should be cautious.

5. **Stability Boundary Proximity:** Flags eigenvalues in the range 0.93 < |λ| < 1.07, where the distinction between near-critical stable and unstable is unreliable. Small data artifacts, trends, or sensor noise can push estimates across the |λ| = 1 boundary. Classification as "Near-Critical" vs "Unstable" should not be treated as definitive in this range.

6. **ADF Stationarity Test (Augmented Dickey-Fuller):** Formally tests each series for unit roots before AR(2) fitting. Regression: Δy(t) = α + γ·y(t-1) + Σ δᵢ·Δy(t-i) + ε. Null hypothesis H₀: γ=0 (unit root / non-stationary). Critical values from MacKinnon (1996) approximation adjusted for sample size. Series failing ADF at the 5% level are flagged but retained for completeness. Short series where the test cannot be computed are conservatively flagged as non-stationary.

Each diagnostic contributes to an overall confidence score (0–100) that determines the reliability rating: High (≥75), Moderate (50–74), Low (25–49), or Unreliable (<25). The ADF test applies a −15 point penalty when a series fails the stationarity check.
`;
        content += diagnosticsSection;
        res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="PAR2_Complete_Analysis_Report.md"');
        res.send(content);
      } else {
        res.status(404).json({ error: "Complete analysis report not found." });
      }
    } catch (error) {
      console.error("Error serving complete analysis report:", error);
      res.status(500).json({ error: "Failed to serve complete analysis report" });
    }
  });

  // Download user manual (public - no password required)
  app.get("/api/download/user-manual", async (req, res) => {
    try {
      const filePath = path.join(process.cwd(), 'docs', 'USER_MANUAL.md');
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf-8');
        res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="PAR2_Discovery_Engine_User_Manual.md"');
        res.send(content);
      } else {
        res.status(404).json({ error: "User manual not found." });
      }
    } catch (error) {
      console.error("Error serving user manual:", error);
      res.status(500).json({ error: "Failed to serve user manual" });
    }
  });

  // Download blind spot validation report (public - no password required)
  app.get("/api/download/blind-spot-validation-report", async (req, res) => {
    try {
      const filePath = path.join(process.cwd(), 'docs', 'BLIND_SPOT_VALIDATION_REPORT.md');
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf-8');
        res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="PAR2_Blind_Spot_Validation_Report.md"');
        res.send(content);
      } else {
        res.status(404).json({ error: "Blind spot validation report not found." });
      }
    } catch (error) {
      console.error("Error serving blind spot validation report:", error);
      res.status(500).json({ error: "Failed to serve blind spot validation report" });
    }
  });

  app.get("/api/download/diagnostic-report", async (req, res) => {
    const auth = verifyDownloadPassword(req);
    if (!auth.valid) {
      return res.status(401).json({ error: auth.error });
    }
    
    try {
      const filePath = path.join(process.cwd(), 'public', 'diagnostics', 'par2_full_diagnostic_report.txt');
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf-8');
        res.setHeader('Content-Type', 'text/plain');
        res.setHeader('Content-Disposition', 'attachment; filename="PAR2_Full_Diagnostic_Report.txt"');
        res.send(content);
      } else {
        res.status(404).json({ error: "Diagnostic report not found. Run a full diagnostic first." });
      }
    } catch (error) {
      console.error("Error serving diagnostic report:", error);
      res.status(500).json({ error: "Failed to serve diagnostic report" });
    }
  });

  app.get("/api/download/diagnostic-csv", async (req, res) => {
    const auth = verifyDownloadPassword(req);
    if (!auth.valid) {
      return res.status(401).json({ error: auth.error });
    }
    
    try {
      const filePath = path.join(process.cwd(), 'public', 'diagnostics', 'all_datasets_summary.csv');
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf-8');
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="PAR2_All_Datasets_Summary.csv"');
        res.send(content);
      } else {
        res.status(404).json({ error: "Diagnostic CSV not found. Run a full diagnostic first." });
      }
    } catch (error) {
      console.error("Error serving diagnostic CSV:", error);
      res.status(500).json({ error: "Failed to serve diagnostic CSV" });
    }
  });

  // Download eigenvalue survey results (JSON or text format)
  app.get("/api/download/eigenvalue-survey", async (req, res) => {
    try {
      const format = req.query.format === 'txt' ? 'txt' : 'json';
      const jsonPath = path.join(process.cwd(), 'EIGENVALUE_SURVEY.json');
      const txtPath = path.join(process.cwd(), 'EIGENVALUE_SURVEY.txt');
      
      if (format === 'txt') {
        if (fs.existsSync(txtPath)) {
          const content = fs.readFileSync(txtPath, 'utf-8');
          res.setHeader('Content-Type', 'text/plain; charset=utf-8');
          res.setHeader('Content-Disposition', 'attachment; filename="EIGENVALUE_SURVEY.txt"');
          res.send(content);
        } else {
          res.status(404).json({ error: "Eigenvalue survey text report not found. Run the survey script first." });
        }
      } else {
        if (fs.existsSync(jsonPath)) {
          const content = fs.readFileSync(jsonPath, 'utf-8');
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Content-Disposition', 'attachment; filename="EIGENVALUE_SURVEY.json"');
          res.send(content);
        } else {
          res.status(404).json({ error: "Eigenvalue survey not found. Run the survey script first." });
        }
      }
    } catch (error) {
      console.error("Error serving eigenvalue survey:", error);
      res.status(500).json({ error: "Failed to serve eigenvalue survey" });
    }
  });

  // Download null/permutation survey results (stress test)
  app.get("/api/download/null-survey", async (req, res) => {
    try {
      const format = req.query.format === 'txt' ? 'txt' : 'json';
      const jsonPath = path.join(process.cwd(), 'PAR2_NULL_SURVEY.json');
      const txtPath = path.join(process.cwd(), 'PAR2_NULL_SURVEY.txt');
      
      if (format === 'txt') {
        if (fs.existsSync(txtPath)) {
          const content = fs.readFileSync(txtPath, 'utf-8');
          res.setHeader('Content-Type', 'text/plain; charset=utf-8');
          res.setHeader('Content-Disposition', 'attachment; filename="PAR2_NULL_SURVEY.txt"');
          res.send(content);
        } else {
          res.status(404).json({ error: "Null survey text report not found. Run the stress test script first." });
        }
      } else {
        if (fs.existsSync(jsonPath)) {
          const content = fs.readFileSync(jsonPath, 'utf-8');
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Content-Disposition', 'attachment; filename="PAR2_NULL_SURVEY.json"');
          res.send(content);
        } else {
          res.status(404).json({ error: "Null survey not found. Run the stress test script first." });
        }
      }
    } catch (error) {
      console.error("Error serving null survey:", error);
      res.status(500).json({ error: "Failed to serve null survey" });
    }
  });

  // Download complete PAR(2) results as CSV (all analyses or unique per dataset)
  app.get("/api/download/results-csv", async (req, res) => {
    try {
      const unique = req.query.unique === 'true';
      
      // Get all completed analysis runs
      const allRuns = await storage.getAllAnalysisRuns();
      const completedRuns = allRuns.filter(r => r.status === 'completed');
      
      if (completedRuns.length === 0) {
        return res.status(404).json({ error: "No completed analyses found" });
      }
      
      // If unique, get only the latest run per dataset
      let runsToExport = completedRuns;
      if (unique) {
        const latestByDataset = new Map<string, typeof completedRuns[0]>();
        for (const run of completedRuns) {
          const existing = latestByDataset.get(run.datasetName);
          if (!existing || new Date(run.createdAt) > new Date(existing.createdAt)) {
            latestByDataset.set(run.datasetName, run);
          }
        }
        runsToExport = Array.from(latestByDataset.values());
      }
      
      // Collect all results
      const rows: any[] = [];
      for (const run of runsToExport) {
        const hypotheses = await storage.getHypothesesByRunId(run.id);
        for (const h of hypotheses) {
          // Determine tier
          let tier = 'EXPLORE';
          if (h.qValue !== null && h.qValue !== undefined) {
            if (h.qValue < 0.01 && (h.effectSizeCohensF2 || 0) >= 0.35) tier = 'STRONG';
            else if (h.qValue < 0.05 && (h.effectSizeCohensF2 || 0) >= 0.35) tier = 'CANDIDATE';
            else if (h.qValue < 0.10) tier = 'WEAK';
          }
          
          rows.push({
            analysis_name: run.name,
            dataset_name: run.datasetName,
            target_gene: h.targetGene,
            clock_gene: h.clockGene,
            significant: h.significant ? 'TRUE' : 'FALSE',
            p_value: h.pValue,
            q_value: h.qValue ?? '',
            significant_after_fdr: h.significantAfterFDR ? 'TRUE' : 'FALSE',
            effect_size_f2: h.effectSizeCohensF2 ?? '',
            effect_size_interpretation: h.effectSizeInterpretation ?? '',
            significant_terms: (h.significantTerms || []).join(';'),
            tier: tier
          });
        }
      }
      
      // Sort by dataset, then q-value, then p-value
      rows.sort((a, b) => {
        if (a.dataset_name !== b.dataset_name) return a.dataset_name.localeCompare(b.dataset_name);
        const qA = a.q_value === '' ? 999 : Number(a.q_value);
        const qB = b.q_value === '' ? 999 : Number(b.q_value);
        if (qA !== qB) return qA - qB;
        return Number(a.p_value) - Number(b.p_value);
      });
      
      // Build CSV with metadata header including dataset names prominently
      const datasetNames = runsToExport.map(r => r.datasetName).join(', ');
      const metadataHeader = `# ========================================\n# PAR(2) Discovery Engine Results Export\n# ========================================\n# Engine Version: ${ENGINE_VERSION}\n# Export Time (UTC): ${new Date().toISOString()}\n#\n# DATASETS INCLUDED (${runsToExport.length}):\n${runsToExport.map(r => `#   - ${r.datasetName}`).join('\n')}\n#\n# Total Gene Pairs: ${rows.length}\n# ========================================\n#\n`;
      const headers = ['analysis_name', 'dataset_name', 'engine_version', 'target_gene', 'clock_gene', 'significant', 'p_value', 'q_value', 'significant_after_fdr', 'effect_size_f2', 'effect_size_interpretation', 'significant_terms', 'tier'];
      let csv = metadataHeader + headers.join(',') + '\n';
      
      // Add engine version to each row
      for (const row of rows) {
        row.engine_version = ENGINE_VERSION;
      }
      
      for (const row of rows) {
        const values = headers.map(h => {
          const val = row[h];
          if (val === null || val === undefined) return '';
          const str = String(val);
          if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        });
        csv += values.join(',') + '\n';
      }
      
      const filename = generateAuditFilename(
        unique ? 'PAR2_Results_Unique' : 'PAR2_Results_All',
        'csv'
      );
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(csv);
    } catch (error) {
      console.error("Error exporting results CSV:", error);
      res.status(500).json({ error: "Failed to export results" });
    }
  });

  // Real NCBI GEO datasets with direct download URLs for processed data
  // These link to actual supplementary files or series matrix files from GEO
  const GEO_DATASETS: Record<string, { 
    name: string; 
    description: string; 
    geoId: string;
    pmid?: string;
    directUrl: string;
    format: 'series_matrix' | 'supplementary';
  }> = {
    liver: { 
      name: "Mouse Liver Circadian", 
      description: "Zhang et al. 2014 - Liver circadian transcriptome",
      geoId: "GSE54650",
      pmid: "25349387",
      directUrl: "https://ftp.ncbi.nlm.nih.gov/geo/series/GSE54nnn/GSE54650/suppl/GSE54650_normalized_data.txt.gz",
      format: 'supplementary'
    },
    intestine: { 
      name: "Mouse Intestinal Organoids", 
      description: "Stokes et al. 2021 - BMAL1/APC circadian study",
      geoId: "GSE157357",
      pmid: "34534703",
      directUrl: "https://ftp.ncbi.nlm.nih.gov/geo/series/GSE157nnn/GSE157357/suppl/",
      format: 'supplementary'
    },
    liver_highres: { 
      name: "Mouse Liver High-Resolution (Hughes 2009)", 
      description: "Gold-standard circadian dataset - 48 hourly timepoints over 2 days",
      geoId: "GSE11923",
      pmid: "19343201",
      directUrl: "https://www.ncbi.nlm.nih.gov/geo/download/?acc=GSE11923&format=file&file=GSE11923%5Fseries%5Fmatrix%2Etxt%2Egz",
      format: 'series_matrix'
    },
    heart: { 
      name: "Mouse Heart Circadian", 
      description: "Cardiac circadian transcriptome",
      geoId: "GSE36407",
      directUrl: "https://www.ncbi.nlm.nih.gov/geo/download/?acc=GSE36407&format=file&file=GSE36407%5Fseries%5Fmatrix%2Etxt%2Egz",
      format: 'series_matrix'
    },
    human_blood: { 
      name: "Human Blood Circadian", 
      description: "Archer et al. 2014 - Forced desynchrony blood transcriptome",
      geoId: "GSE48113",
      directUrl: "https://ftp.ncbi.nlm.nih.gov/geo/series/GSE48nnn/GSE48113/soft/GSE48113_family.soft.gz",
      format: 'supplementary'
    },
    kidney: { 
      name: "Mouse Kidney Circadian", 
      description: "Renal circadian gene expression",
      geoId: "GSE54652",
      directUrl: "https://www.ncbi.nlm.nih.gov/geo/download/?acc=GSE54652&format=file&file=GSE54652%5Fseries%5Fmatrix%2Etxt%2Egz",
      format: 'series_matrix'
    },
    adipose: { 
      name: "Mouse Adipose Tissue", 
      description: "White adipose circadian rhythms",
      geoId: "GSE54651",
      directUrl: "https://www.ncbi.nlm.nih.gov/geo/download/?acc=GSE54651&format=file&file=GSE54651%5Fseries%5Fmatrix%2Etxt%2Egz",
      format: 'series_matrix'
    },
    muscle: { 
      name: "Mouse Skeletal Muscle", 
      description: "Muscle circadian expression",
      geoId: "GSE43071",
      directUrl: "https://www.ncbi.nlm.nih.gov/geo/download/?acc=GSE43071&format=file&file=GSE43071%5Fseries%5Fmatrix%2Etxt%2Egz",
      format: 'series_matrix'
    }
  };

  // Endpoint to list available GEO datasets
  app.get("/api/geo-datasets", (req, res) => {
    const datasets = Object.entries(GEO_DATASETS).map(([id, info]) => ({
      id,
      name: info.name,
      description: info.description,
      geoId: info.geoId,
      pmid: info.pmid,
      geoUrl: `https://www.ncbi.nlm.nih.gov/geo/query/acc.cgi?acc=${info.geoId}`
    }));
    res.json(datasets);
  });

  // Redirect to GEO download page for the dataset
  app.get("/api/geo-datasets/:tissue/redirect", (req, res) => {
    const { tissue } = req.params;
    
    if (!GEO_DATASETS[tissue]) {
      return res.status(404).json({ error: `Unknown tissue type: ${tissue}` });
    }
    
    const info = GEO_DATASETS[tissue];
    // Redirect to GEO's supplementary files page where user can download processed data
    res.redirect(`https://www.ncbi.nlm.nih.gov/geo/query/acc.cgi?acc=${info.geoId}`);
  });

  // Get direct download info for a tissue
  app.get("/api/geo-datasets/:tissue/info", (req, res) => {
    const { tissue } = req.params;
    
    if (!GEO_DATASETS[tissue]) {
      return res.status(404).json({ error: `Unknown tissue type: ${tissue}` });
    }
    
    const info = GEO_DATASETS[tissue];
    res.json({
      tissue,
      geoId: info.geoId,
      name: info.name,
      description: info.description,
      pmid: info.pmid,
      geoPage: `https://www.ncbi.nlm.nih.gov/geo/query/acc.cgi?acc=${info.geoId}`,
      supplementaryFiles: `https://www.ncbi.nlm.nih.gov/geo/download/?acc=${info.geoId}&format=file`,
      seriesMatrix: `https://www.ncbi.nlm.nih.gov/geo/download/?acc=${info.geoId}&format=file&file=${info.geoId}_series_matrix.txt.gz`,
      instructions: [
        `1. Go to: https://www.ncbi.nlm.nih.gov/geo/query/acc.cgi?acc=${info.geoId}`,
        "2. Scroll to 'Supplementary file' section",
        "3. Download the processed expression matrix (usually ends in _normalized.txt or _expression.csv)",
        "4. If only raw data available, use GEO2R to process: https://www.ncbi.nlm.nih.gov/geo/geo2r/?acc=" + info.geoId,
        "5. Upload the processed CSV/TSV file to this PAR(2) analyzer"
      ]
    });
  });

  // Download LaTeX paper files (password protected - contains methodology)
  app.get("/api/download/paper-latex", async (req, res) => {
    const auth = verifyDownloadPassword(req);
    if (!auth.valid) {
      return res.status(401).json({ error: auth.error });
    }
    
    try {
      const archiver = await import('archiver');
      const fs = await import('fs');
      const path = await import('path');
      
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', 'attachment; filename=PAR2_Cell_Manuscript.zip');
      
      const archive = archiver.default('zip', { zlib: { level: 9 } });
      archive.pipe(res);
      
      const paperDir = path.join(process.cwd(), 'paper');
      
      // Add all paper files
      const files = ['manuscript.tex', 'references.bib', 'cell.bst', 'README.md'];
      for (const file of files) {
        const filePath = path.join(paperDir, file);
        if (fs.existsSync(filePath)) {
          archive.file(filePath, { name: file });
        }
      }
      
      await archive.finalize();
    } catch (error) {
      console.error('Error creating paper archive:', error);
      res.status(500).json({ error: 'Failed to create paper archive' });
    }
  });

  // Download individual LaTeX file (password protected)
  app.get("/api/download/paper/:filename", async (req, res) => {
    const auth = verifyDownloadPassword(req);
    if (!auth.valid) {
      return res.status(401).json({ error: auth.error });
    }
    
    try {
      const fs = await import('fs');
      const path = await import('path');
      
      const { filename } = req.params;
      const allowedFiles = ['manuscript.tex', 'references.bib', 'cell.bst', 'README.md'];
      
      if (!allowedFiles.includes(filename)) {
        return res.status(404).json({ error: 'File not found' });
      }
      
      const filePath = path.join(process.cwd(), 'paper', filename);
      
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'File not found' });
      }
      
      const contentTypes: Record<string, string> = {
        '.tex': 'application/x-tex',
        '.bib': 'application/x-bibtex',
        '.bst': 'text/plain',
        '.md': 'text/markdown'
      };
      
      const ext = path.extname(filename);
      res.setHeader('Content-Type', contentTypes[ext] || 'text/plain');
      res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
      
      const content = fs.readFileSync(filePath, 'utf-8');
      res.send(content);
    } catch (error) {
      console.error('Error downloading paper file:', error);
      res.status(500).json({ error: 'Failed to download file' });
    }
  });

  // Download diagnostic files (password protected)
  app.get("/api/download/diagnostics/:filename", async (req, res) => {
    const auth = verifyDownloadPassword(req);
    if (!auth.valid) {
      return res.status(401).json({ error: auth.error });
    }
    
    try {
      const { filename } = req.params;
      const allowedFiles = [
        'par2_diagnostic.json', 
        'par2_diagnostic_report.txt', 
        'tissue_summary.csv', 
        'validation_results.csv',
        'par2_full_diagnostic.json',
        'par2_full_diagnostic_report.txt',
        'all_datasets_summary.csv'
      ];
      
      if (!allowedFiles.includes(filename)) {
        return res.status(404).json({ error: 'File not found' });
      }
      
      const filePath = path.join(process.cwd(), 'public', 'diagnostics', filename);
      
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'Diagnostic file not found. Run diagnostics first.' });
      }
      
      const contentTypes: Record<string, string> = {
        '.json': 'application/json',
        '.txt': 'text/plain',
        '.csv': 'text/csv'
      };
      
      const ext = path.extname(filename);
      res.setHeader('Content-Type', contentTypes[ext] || 'text/plain');
      res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
      
      const content = fs.readFileSync(filePath, 'utf-8');
      res.send(content);
    } catch (error) {
      console.error('Error downloading diagnostic file:', error);
      res.status(500).json({ error: 'Failed to download diagnostic file' });
    }
  });

  // Download PDF of the manuscript (password protected)
  app.get("/api/download/paper-pdf", async (req, res) => {
    const auth = verifyDownloadPassword(req);
    if (!auth.valid) {
      return res.status(401).json({ error: auth.error });
    }
    
    try {
      const fs = await import('fs');
      const path = await import('path');
      
      const pdfPath = path.join(process.cwd(), 'paper', 'manuscript.pdf');
      
      if (!fs.existsSync(pdfPath)) {
        return res.status(404).json({ error: 'PDF not found. Please compile the LaTeX first.' });
      }
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename=PAR2_Gatekeeper_Switching_Manuscript.pdf');
      
      const pdfBuffer = fs.readFileSync(pdfPath);
      res.send(pdfBuffer);
    } catch (error) {
      console.error('Error downloading PDF:', error);
      res.status(500).json({ error: 'Failed to download PDF' });
    }
  });

  app.get("/api/download/paper-e-word", async (req, res) => {
    const auth = verifyDownloadPassword(req);
    if (!auth.valid) {
      return res.status(401).json({ error: auth.error });
    }
    try {
      const docxPath = path.join(process.cwd(), 'paper-packages', 'paper-e-cell-systems', 'Paper_E_Phase_Gated_PAR2_PLOSONE.docx');
      if (!fs.existsSync(docxPath)) {
        return res.status(404).json({ error: 'Word document not found.' });
      }
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', 'attachment; filename=Paper_E_Phase_Gated_PAR2_PLOSONE.docx');
      const buffer = fs.readFileSync(docxPath);
      res.send(buffer);
    } catch (error) {
      console.error('Error downloading Word document:', error);
      res.status(500).json({ error: 'Failed to download Word document' });
    }
  });

  // Download the complete manuscript LaTeX file directly (no password - it's the main deliverable)
  app.get("/api/download/complete-manuscript", async (req, res) => {
    try {
      const manuscriptPath = path.join(process.cwd(), 'manuscripts', 'PAR2_Complete_Manuscript.tex');
      
      console.log('[Download] Serving manuscript from:', manuscriptPath);
      
      if (!fs.existsSync(manuscriptPath)) {
        return res.status(404).json({ error: 'Manuscript not found' });
      }
      
      const content = fs.readFileSync(manuscriptPath, 'utf-8');
      console.log('[Download] Manuscript length:', content.length, 'bytes,', content.split('\n').length, 'lines');
      
      // No caching
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.setHeader('Content-Type', 'application/x-tex; charset=utf-8');
      res.setHeader('Content-Length', Buffer.byteLength(content, 'utf-8'));
      res.setHeader('Content-Disposition', 'attachment; filename=PAR2_Complete_Manuscript.tex');
      
      res.send(content);
    } catch (error) {
      console.error('Error downloading manuscript:', error);
      res.status(500).json({ error: 'Failed to download manuscript' });
    }
  });

  // Download the references.bib file directly
  app.get("/api/download/references-bib", async (req, res) => {
    try {
      const bibPath = path.join(process.cwd(), 'manuscripts', 'references.bib');
      
      if (!fs.existsSync(bibPath)) {
        return res.status(404).json({ error: 'References file not found' });
      }
      
      const content = fs.readFileSync(bibPath, 'utf-8');
      
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.setHeader('Content-Type', 'application/x-bibtex; charset=utf-8');
      res.setHeader('Content-Length', Buffer.byteLength(content, 'utf-8'));
      res.setHeader('Content-Disposition', 'attachment; filename=references.bib');
      
      res.send(content);
    } catch (error) {
      console.error('Error downloading references:', error);
      res.status(500).json({ error: 'Failed to download references' });
    }
  });

  // Complete Zenodo Package - combines all assets into a single downloadable ZIP
  app.get("/api/download/complete-zenodo-package", async (req, res) => {
    const auth = verifyDownloadPassword(req);
    if (!auth.valid) {
      return res.status(401).json({ error: auth.error, requiresPassword: true });
    }
    
    try {
      const archive = archiver('zip', { zlib: { level: 9 } });
      
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="PAR2_Complete_Zenodo_Package_${new Date().toISOString().split('T')[0]}.zip"`);
      
      archive.on('error', (err: Error) => {
        console.error('Archive error:', err);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Failed to create archive' });
        }
      });
      
      archive.pipe(res);
      
      // 1. Source code directories (excluding node_modules)
      const sourceDirs = ['client', 'server', 'shared', 'scripts'];
      for (const dir of sourceDirs) {
        if (fs.existsSync(dir)) {
          archive.glob(`${dir}/**/*`, { 
            ignore: ['**/node_modules/**', '**/.git/**'] 
          }, { prefix: 'source' });
        }
      }
      
      // 2. Documentation
      if (fs.existsSync('docs')) {
        archive.directory('docs', 'documentation');
      }
      
      // 3. Manuscripts and validation reports
      if (fs.existsSync('manuscripts')) {
        archive.directory('manuscripts', 'manuscripts');
      }
      
      // 4. Embedded datasets (CSV, MD, TXT files only)
      if (fs.existsSync('datasets')) {
        archive.glob('datasets/**/*.{csv,md,txt}', {}, { prefix: '' });
      }
      
      // 5. Configuration files
      const configFiles = [
        'package.json',
        'tsconfig.json',
        'vite.config.ts',
        'drizzle.config.ts',
        'zenodo.json',
        'CITATION.cff',
        'LICENSE',
        'NOTICE',
        'README.md',
        'INSTALL.md',
        'CLA.md',
        'ZENODO_UPLOAD.md',
        'docker-compose.yml',
        'Dockerfile'
      ];
      
      for (const file of configFiles) {
        if (fs.existsSync(file)) {
          archive.file(file, { name: file });
        }
      }
      
      // 6. Generate and include a manifest
      const manifest = {
        packageName: 'PAR(2) Discovery Engine - Complete Zenodo Archive',
        version: ENGINE_VERSION,
        generatedAt: new Date().toISOString(),
        contents: {
          source: 'Complete application source code (TypeScript/React/Express)',
          documentation: 'User manual, validation reports, analysis methodology',
          manuscripts: 'LaTeX manuscripts, validation JSON files, figures',
          datasets: 'Embedded circadian gene expression datasets (CSV format)',
          configuration: 'Build and deployment configuration files'
        },
        license: 'Dual License - Free for academic use, commercial license required for industry',
        citation: 'See CITATION.cff for proper citation format',
        contact: 'mickwh@msn.com'
      };
      archive.append(JSON.stringify(manifest, null, 2), { name: 'MANIFEST.json' });
      
      await archive.finalize();
      
    } catch (error) {
      console.error('Error creating Zenodo package:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to create Zenodo package' });
      }
    }
  });

  // View the manuscript in browser (for debugging caching issues)
  app.get("/api/view/complete-manuscript", async (req, res) => {
    try {
      const manuscriptPath = path.join(process.cwd(), 'manuscripts', 'PAR2_Complete_Manuscript.tex');
      
      if (!fs.existsSync(manuscriptPath)) {
        return res.status(404).json({ error: 'Manuscript not found' });
      }
      
      const content = fs.readFileSync(manuscriptPath, 'utf-8');
      const lines = content.split('\n');
      
      // No caching
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      
      const html = `<!DOCTYPE html>
<html>
<head>
  <title>PAR2 Complete Manuscript - ${lines.length} lines</title>
  <style>
    body { font-family: monospace; background: #1a1a2e; color: #eee; padding: 20px; }
    h1 { color: #4ade80; }
    .stats { color: #60a5fa; margin-bottom: 20px; }
    pre { background: #16213e; padding: 15px; border-radius: 8px; overflow-x: auto; line-height: 1.4; }
    .line-num { color: #666; user-select: none; }
  </style>
</head>
<body>
  <h1>PAR2_Complete_Manuscript.tex</h1>
  <div class="stats">
    <strong>Lines:</strong> ${lines.length} | 
    <strong>Characters:</strong> ${content.length} | 
    <strong>Sections:</strong> ${(content.match(/\\\\section/g) || []).length} |
    <strong>Tables:</strong> ${(content.match(/\\\\begin\\{table/g) || []).length}
  </div>
  <pre>${content.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
</body>
</html>`;
      
      res.send(html);
    } catch (error) {
      console.error('Error viewing manuscript:', error);
      res.status(500).json({ error: 'Failed to view manuscript' });
    }
  });

  // Download complete journal submission package as ZIP (password protected - contains scripts)
  app.get("/api/download/submission-package", async (req, res) => {
    const auth = verifyDownloadPassword(req);
    if (!auth.valid) {
      return res.status(401).json({ error: auth.error });
    }
    
    try {
      const archiver = await import('archiver');
      
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', 'attachment; filename=PAR2_Complete_Submission_Package.zip');
      
      const archive = archiver.default('zip', { zlib: { level: 9 } });
      archive.pipe(res);
      
      const manuscriptsDir = path.join(process.cwd(), 'manuscripts');
      
      // Main manuscript files
      const mainFiles = [
        'PAR2_Complete_Manuscript.tex',
        'references.bib',
        'cross_tissue_circadian_gating_manuscript.tex',
        'novel_findings_manuscript.tex',
        'tissue_comparison_manuscript.tex',
        'cover_letter.tex',
        'cover_letter_novel.tex',
        'figure_data.json',
        'novel_findings_figure_data.json',
        'README_SUBMISSION.md',
        'README.md',
        'SUBMISSION_CHECKLIST.md'
      ];
      
      for (const file of mainFiles) {
        const filePath = path.join(manuscriptsDir, file);
        if (fs.existsSync(filePath)) {
          archive.file(filePath, { name: file });
        }
      }
      
      // Add supplementary files
      const suppDir = path.join(manuscriptsDir, 'supplementary');
      if (fs.existsSync(suppDir)) {
        const suppFiles = fs.readdirSync(suppDir);
        for (const file of suppFiles) {
          const filePath = path.join(suppDir, file);
          if (fs.statSync(filePath).isFile()) {
            archive.file(filePath, { name: `supplementary/${file}` });
          }
        }
      }
      
      // Add script files
      const scriptsDir = path.join(manuscriptsDir, 'scripts');
      if (fs.existsSync(scriptsDir)) {
        const scripts = fs.readdirSync(scriptsDir);
        for (const script of scripts) {
          const scriptPath = path.join(scriptsDir, script);
          if (fs.statSync(scriptPath).isFile()) {
            archive.file(scriptPath, { name: `scripts/${script}` });
          }
        }
      }
      
      // Add root-level validation files
      const validationFiles = [
        { src: 'EIGENVALUE_SURVEY.json', dest: 'validation/EIGENVALUE_SURVEY.json' },
        { src: 'EIGENVALUE_SURVEY.txt', dest: 'validation/EIGENVALUE_SURVEY.txt' },
        { src: 'PAR2_NULL_SURVEY.json', dest: 'validation/PAR2_NULL_SURVEY.json' },
        { src: 'PAR2_NULL_SURVEY.txt', dest: 'validation/PAR2_NULL_SURVEY.txt' }
      ];
      
      for (const vf of validationFiles) {
        const srcPath = path.join(process.cwd(), vf.src);
        if (fs.existsSync(srcPath)) {
          archive.file(srcPath, { name: vf.dest });
        }
      }
      
      // Generate and add complete results CSV
      const allRuns = await storage.getAllAnalysisRuns();
      const completedRuns = allRuns.filter(r => r.status === 'completed');
      const latestByDataset = new Map<string, typeof completedRuns[0]>();
      for (const run of completedRuns) {
        const existing = latestByDataset.get(run.datasetName);
        if (!existing || new Date(run.createdAt) > new Date(existing.createdAt)) {
          latestByDataset.set(run.datasetName, run);
        }
      }
      
      const rows: any[] = [];
      for (const run of Array.from(latestByDataset.values())) {
        const hypotheses = await storage.getHypothesesByRunId(run.id);
        for (const h of hypotheses) {
          let tier = 'EXPLORE';
          if (h.qValue !== null && h.qValue !== undefined) {
            if (h.qValue < 0.01 && (h.effectSizeCohensF2 || 0) >= 0.35) tier = 'STRONG';
            else if (h.qValue < 0.05 && (h.effectSizeCohensF2 || 0) >= 0.35) tier = 'CANDIDATE';
            else if (h.qValue < 0.10) tier = 'WEAK';
          }
          rows.push({
            dataset: run.datasetName,
            target: h.targetGene,
            clock: h.clockGene,
            significant: h.significant ? 'TRUE' : 'FALSE',
            p_value: h.pValue,
            q_value: h.qValue ?? '',
            fdr_significant: h.significantAfterFDR ? 'TRUE' : 'FALSE',
            effect_size: h.effectSizeCohensF2 ?? '',
            terms: (h.significantTerms || []).join(';'),
            tier: tier
          });
        }
      }
      
      const headers = ['dataset', 'target', 'clock', 'significant', 'p_value', 'q_value', 'fdr_significant', 'effect_size', 'terms', 'tier'];
      let csv = headers.join(',') + '\n';
      for (const row of rows) {
        const values = headers.map(h => {
          const val = row[h];
          if (val === null || val === undefined) return '';
          const str = String(val);
          if (str.includes(',') || str.includes('"')) return `"${str.replace(/"/g, '""')}"`;
          return str;
        });
        csv += values.join(',') + '\n';
      }
      archive.append(csv, { name: 'supplementary/PAR2_All_Results_Export.csv' });
      
      await archive.finalize();
    } catch (error) {
      console.error('Error creating submission package:', error);
      res.status(500).json({ error: 'Failed to create submission package' });
    }
  });

  // Download journal-quality figures as ZIP
  app.get("/api/download/manuscript-figures", async (req, res) => {
    try {
      const archiver = await import('archiver');
      const { generateAllFigures } = await import('../figure-generator');

      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', 'attachment; filename=PAR2_Manuscript_Figures.zip');

      const archive = archiver.default('zip', { zlib: { level: 9 } });
      archive.pipe(res);

      const figures = generateAllFigures();
      let readmeContent = `# PAR(2) Manuscript Figures\n\nGenerated: ${new Date().toISOString().split('T')[0]}\n\nAll figures are in SVG format (scalable vector graphics) — suitable for journal submission.\nSVG files can be opened in any browser, Inkscape, Adobe Illustrator, or converted to PDF/PNG.\n\n## Figures\n\n`;

      for (const fig of figures) {
        archive.append(fig.svg, { name: `figures/${fig.name}` });
        readmeContent += `- **${fig.name}**: ${fig.description}\n`;
      }

      readmeContent += `\n## Data Source\n\nAll values are computed from NCBI GEO datasets using AR(2) autoregressive modeling.\nSee the main manuscript for full methodology and citations.\n\n## Converting to PNG\n\nTo convert SVG to high-resolution PNG (300 DPI):\n\`\`\`bash\n# Using Inkscape\ninkscape --export-type=png --export-dpi=300 Figure_1_Healthy_Tissue_Hierarchy.svg\n\n# Using rsvg-convert\nrsvg-convert -d 300 -p 300 Figure_1_Healthy_Tissue_Hierarchy.svg > Figure_1.png\n\`\`\`\n`;

      archive.append(readmeContent, { name: 'figures/README.md' });

      await archive.finalize();
    } catch (error) {
      console.error('Error creating figures package:', error);
      res.status(500).json({ error: 'Failed to create figures package' });
    }
  });

  app.get("/api/download/manuscript-pdf-with-figures", async (req, res) => {
    try {
      const { PDFDocument, rgb, StandardFonts } = await import('pdf-lib');
      const sharp = (await import('sharp')).default;
      const { generateAllFigures } = await import('../figure-generator');

      const existingPdfPath = path.join(process.cwd(), 'manuscripts', 'PAR2_Complete_Manuscript.pdf');
      if (!fs.existsSync(existingPdfPath)) {
        return res.status(404).json({ error: 'Base manuscript PDF not found' });
      }

      const existingPdfBytes = fs.readFileSync(existingPdfPath);
      const pdfDoc = await PDFDocument.load(existingPdfBytes);

      const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const helveticaOblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

      const PAGE_W = 612;
      const PAGE_H = 792;
      const MARGIN = 54;
      const FIG_AREA_W = PAGE_W - 2 * MARGIN;

      const figures = generateAllFigures();

      const figureDescriptions: Record<string, string> = {
        'Figure_1_Healthy_Tissue_Hierarchy.svg': 'Figure 1. Clock-target eigenvalue hierarchy across healthy mouse tissues (GSE54650). Clock genes consistently show higher AR(2) eigenvalue modulus than target genes across liver, heart, and kidney, establishing the baseline gearbox hierarchy.',
        'Figure_2_Cancer_Disruption.svg': 'Figure 2. Cancer disrupts the clock-target hierarchy. In MYC-ON neuroblastoma (GSE11923), target gene eigenvalues exceed clock gene eigenvalues (gap = -0.086), inverting the healthy pattern. MYC-OFF recovery partially restores the hierarchy (gap = +0.127). Organoid data (GSE157357) shows ApcKO similarly inverts the gap.',
        'Figure_3_Baboon_Cross_Species.svg': 'Figure 3. Cross-species validation in Papio anubis (baboon) circadian atlas (GSE98965). Of 14 tissues with sufficient gene coverage, 8 (57%) preserve the clock > target eigenvalue hierarchy observed in mouse, providing independent phylogenetic support for the gearbox pattern.',
        'Figure_4_p53_Pathway.svg': 'Figure 4. p53 pathway eigenvalue dynamics in healthy vs. cancer conditions. In healthy tissues, p53 pathway genes (TP53, MDM2, GADD45A) behave like targets (low persistence). In MYC-ON cancer, p53 pathway eigenvalues jump to 0.665, exceeding both clock and target means, consistent with a chronically activated DNA damage response.',
        'Figure_5_Desynchrony_Index.svg': 'Figure 5. Clock desynchrony index (coefficient of variation of clock gene eigenvalues) across tissues and conditions. Healthy tissues show low CV (0.148-0.218), indicating synchronized clock gene dynamics. Cancer (MYC-ON) shows elevated CV (0.312), suggesting clock gene desynchronization.',
        'Figure_6_Model_Order_Selection.svg': 'Figure 6. AR model order comparison. AR(2) achieves the best balance: 93% residual whiteness (vs. 67% for AR(1)), while preserving the eigenvalue gap (+0.245 vs. -0.012 for AR(3)). AR(1) underfits; AR(3) overfits by absorbing biologically meaningful variance.',
        'Figure_7_Aging_Patterns.svg': 'Figure 7. Aging effects on clock gene eigenvalue modulus (GSE118668). Aged mice show reduced clock persistence (0.754 vs. 0.824 in adults), while caloric restriction (CR) partially preserves eigenvalue magnitude in both age groups, suggesting CR protects circadian temporal integrity.'
      };

      for (const fig of figures) {
        const pngBuffer = await sharp(Buffer.from(fig.svg))
          .resize({ width: Math.round(FIG_AREA_W * 2), fit: 'inside' })
          .flatten({ background: { r: 255, g: 255, b: 255 } })
          .png({ quality: 100 })
          .toBuffer();

        const pngImage = await pdfDoc.embedPng(pngBuffer);
        const imgAspect = pngImage.width / pngImage.height;
        let imgW = FIG_AREA_W;
        let imgH = imgW / imgAspect;
        const maxImgH = PAGE_H - 2 * MARGIN - 100;
        if (imgH > maxImgH) {
          imgH = maxImgH;
          imgW = imgH * imgAspect;
        }

        const page = pdfDoc.addPage([PAGE_W, PAGE_H]);
        const imgX = (PAGE_W - imgW) / 2;
        const imgY = PAGE_H - MARGIN - imgH - 20;

        page.drawImage(pngImage, {
          x: imgX,
          y: imgY,
          width: imgW,
          height: imgH,
        });

        page.drawLine({
          start: { x: MARGIN, y: imgY - 8 },
          end: { x: PAGE_W - MARGIN, y: imgY - 8 },
          thickness: 0.5,
          color: rgb(0.8, 0.8, 0.8),
        });

        const caption = figureDescriptions[fig.name] || fig.description;
        const captionLines = wrapText(caption, helvetica, 9, FIG_AREA_W);
        let captionY = imgY - 22;
        for (const line of captionLines) {
          if (captionY < MARGIN) break;
          const isFirstLine = line === captionLines[0];
          const boldEnd = line.indexOf('.');
          if (isFirstLine && boldEnd > 0 && boldEnd < 30) {
            const boldPart = line.substring(0, boldEnd + 1);
            const restPart = line.substring(boldEnd + 1);
            page.drawText(boldPart, {
              x: MARGIN,
              y: captionY,
              size: 9,
              font: helveticaBold,
              color: rgb(0.1, 0.1, 0.1),
            });
            const boldWidth = helveticaBold.widthOfTextAtSize(boldPart, 9);
            if (restPart.trim()) {
              page.drawText(restPart, {
                x: MARGIN + boldWidth,
                y: captionY,
                size: 9,
                font: helvetica,
                color: rgb(0.2, 0.2, 0.2),
              });
            }
          } else {
            page.drawText(line, {
              x: MARGIN,
              y: captionY,
              size: 9,
              font: helvetica,
              color: rgb(0.2, 0.2, 0.2),
            });
          }
          captionY -= 13;
        }

        page.drawText(`PAR(2) Discovery Engine — Manuscript Figures`, {
          x: MARGIN,
          y: 30,
          size: 7,
          font: helveticaOblique,
          color: rgb(0.6, 0.6, 0.6),
        });
      }

      const pdfBytes = await pdfDoc.save();

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=PAR2_Complete_Manuscript_with_Figures.pdf`);
      res.send(Buffer.from(pdfBytes));
    } catch (error) {
      console.error('Error generating manuscript PDF with figures:', error);
      res.status(500).json({ error: 'Failed to generate manuscript PDF with figures' });
    }
  });

  // Generate and download publication-ready figure data (password protected - contains scripts)
  app.get("/api/download/figure-package", async (req, res) => {
    const auth = verifyDownloadPassword(req);
    if (!auth.valid) {
      return res.status(401).json({ error: auth.error });
    }
    
    try {
      const archiver = await import('archiver');
      
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', 'attachment; filename=PAR2_Figures.zip');
      
      const archive = archiver.default('zip', { zlib: { level: 9 } });
      archive.pipe(res);
      
      // Get all analysis data for figures
      const analyses = await storage.getAllAnalysisRuns();
      const tissueData: Record<string, any> = {};
      
      for (const run of analyses) {
        if (run.status === 'completed' && run.datasetName?.includes('GSE54650')) {
          const result = await storage.getAnalysisRunWithHypotheses(run.id);
          if (result && result.hypotheses.length > 0) {
            // Extract tissue name
            const tissueMatch = run.datasetName.match(/GSE54650_(\w+)_circadian/);
            if (tissueMatch) {
              const tissue = tissueMatch[1].replace(/_/g, ' ');
              tissueData[tissue] = result.hypotheses;
            }
          }
        }
      }
      
      // Figure 1: Discovery rates bar chart data
      const figure1Data = Object.entries(tissueData).map(([tissue, hypotheses]: [string, any[]]) => {
        const significant = hypotheses.filter(h => h.significant).length;
        return {
          tissue,
          significant,
          total: hypotheses.length,
          rate: (significant / hypotheses.length * 100).toFixed(1)
        };
      }).sort((a, b) => parseFloat(b.rate) - parseFloat(a.rate));
      
      archive.append(JSON.stringify(figure1Data, null, 2), { name: 'figure1_discovery_rates.json' });
      
      // Figure 2: Heatmap data
      const clockGenes = ['Per1', 'Per2', 'Per3', 'Cry1', 'Cry2', 'Clock', 'Arntl', 'Nr1d1', 'Nr1d2', 'Dbp', 'Tef', 'Npas2', 'Rorc'];
      const figure2Data: any = { tissues: {}, clockGenes };
      
      Object.entries(tissueData).forEach(([tissue, hypotheses]: [string, any[]]) => {
        const targetGroups: Record<string, number[]> = {};
        
        hypotheses.filter(h => h.significant).forEach(h => {
          if (!targetGroups[h.targetGene]) {
            targetGroups[h.targetGene] = new Array(clockGenes.length).fill(null);
          }
          const clockIdx = clockGenes.indexOf(h.clockGene);
          if (clockIdx >= 0) {
            targetGroups[h.targetGene][clockIdx] = -Math.log10(h.pValue);
          }
        });
        
        if (Object.keys(targetGroups).length > 0) {
          figure2Data.tissues[tissue] = targetGroups;
        }
      });
      
      archive.append(JSON.stringify(figure2Data, null, 2), { name: 'figure2_heatmap.json' });
      
      // Figure 3: Pathway model
      const figure3Data = {
        model: "Tissue Vulnerability Protection",
        tissues: [
          { name: "Liver", pathway: "DNA Repair + Cell Cycle", targets: ["Atm", "Wee1", "Ccnd1", "Ccnb1", "Mdm2"], vulnerability: "Hepatocellular carcinoma" },
          { name: "Heart", pathway: "Hippo/YAP Growth Control", targets: ["Tead1", "Yap1"], vulnerability: "Cardiac hypertrophy" },
          { name: "Cerebellum", pathway: "Mitosis Control", targets: ["Cdk1"], vulnerability: "Medulloblastoma" },
          { name: "Hypothalamus", pathway: "Metabolism + DNA Checkpoint", targets: ["Sirt1", "Chek2"], vulnerability: "Neurodegeneration" },
          { name: "Kidney", pathway: "Proliferation Control", targets: ["Myc"], vulnerability: "Renal cell carcinoma" }
        ]
      };
      
      archive.append(JSON.stringify(figure3Data, null, 2), { name: 'figure3_pathway_model.json' });
      
      // CSV version for Excel/R/Python
      let figure1CSV = 'Tissue,Significant,Total,Rate\n';
      figure1Data.forEach(d => {
        figure1CSV += `${d.tissue},${d.significant},${d.total},${d.rate}\n`;
      });
      archive.append(figure1CSV, { name: 'figure1_discovery_rates.csv' });
      
      // All significant results for supplementary
      let allSignificantCSV = 'Tissue,Target,TargetRole,Clock,ClockRole,PValue,SignificantTerms\n';
      Object.entries(tissueData).forEach(([tissue, hypotheses]: [string, any[]]) => {
        hypotheses.filter(h => h.significant).forEach(h => {
          allSignificantCSV += `${tissue},${h.targetGene},${h.targetRole},${h.clockGene},${h.clockRole},${h.pValue},${h.significantTerms?.join(';') || ''}\n`;
        });
      });
      archive.append(allSignificantCSV, { name: 'all_significant_results.csv' });
      
      // Add actual R and Python script files
      const scriptsDir = path.join(process.cwd(), 'manuscripts', 'scripts');
      const scriptFiles = [
        'figure1_discovery_rates.R',
        'figure1_discovery_rates.py',
        'figure2_heatmap.R',
        'figure2_heatmap.py',
        'figure3_model.py'
      ];
      
      for (const scriptFile of scriptFiles) {
        const scriptPath = path.join(scriptsDir, scriptFile);
        if (fs.existsSync(scriptPath)) {
          archive.file(scriptPath, { name: `scripts/${scriptFile}` });
        }
      }
      
      // Figure generation instructions
      const figureInstructions = `# Figure Generation Instructions

## Figure 1: Discovery Rates Bar Chart

**Data file**: figure1_discovery_rates.json / .csv

**R code**:
\`\`\`r
library(ggplot2)
data <- read.csv("figure1_discovery_rates.csv")
ggplot(data, aes(x=reorder(Tissue, -Rate), y=Rate, fill=Tissue)) +
  geom_bar(stat="identity") +
  labs(x="Tissue", y="Discovery Rate (%)", 
       title="Circadian Gating Discovery Rates") +
  theme_minimal() +
  theme(axis.text.x = element_text(angle=45, hjust=1))
\`\`\`

**Python code**:
\`\`\`python
import pandas as pd
import matplotlib.pyplot as plt

data = pd.read_csv("figure1_discovery_rates.csv")
plt.bar(data['Tissue'], data['Rate'])
plt.xlabel('Tissue')
plt.ylabel('Discovery Rate (%)')
plt.title('Circadian Gating Discovery Rates')
plt.xticks(rotation=45)
plt.tight_layout()
plt.savefig('figure1.pdf')
\`\`\`

## Figure 2: Heatmap

**Data file**: figure2_heatmap.json

**R code**:
\`\`\`r
library(pheatmap)
library(jsonlite)
data <- fromJSON("figure2_heatmap.json")
# Process and create heatmap per tissue
\`\`\`

## Figure 3: Pathway Model (Schematic)

**Data file**: figure3_pathway_model.json

This should be created manually in:
- Adobe Illustrator
- BioRender (https://biorender.com)
- PowerPoint
- Inkscape

Suggested layout: Central circadian clock with arrows to each tissue box showing protected pathways.

## Color Scheme Suggestions

- Liver: #E74C3C (red)
- Heart: #9B59B6 (purple)  
- Kidney: #3498DB (blue)
- Cerebellum: #2ECC71 (green)
- Hypothalamus: #F39C12 (orange)
- Clock genes: #1ABC9C (teal)
`;
      
      archive.append(figureInstructions, { name: 'FIGURE_INSTRUCTIONS.md' });
      
      await archive.finalize();
    } catch (error) {
      console.error('Error creating figure package:', error);
      res.status(500).json({ error: 'Failed to create figure package' });
    }
  });

  // Download complete portable package for local deployment (PASSWORD PROTECTED)
  app.get("/api/download/portable-package", async (req, res) => {
    const auth = verifyDownloadPassword(req);
    if (!auth.valid) {
      return res.status(401).json({ error: auth.error, requiresPassword: true });
    }
    
    try {
      const archiver = await import('archiver');
      
      // Add timestamp to filename and disable caching to prevent stale downloads
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename=PAR2_Discovery_Engine_v${timestamp}.zip`);
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      
      const archive = archiver.default('zip', { zlib: { level: 9 } });
      archive.pipe(res);
      
      const baseDir = process.cwd();
      
      // Core application files (required)
      const requiredFiles = [
        'package.json',
        'package-lock.json',
        'tsconfig.json',
        'vite.config.ts',
        'vite-plugin-meta-images.ts',
        'postcss.config.js',
        'drizzle.config.ts',
        'README.md',
        'INSTALL.md',
        'LICENSE'
      ];
      
      // Optional files
      const optionalFiles = [
        'tailwind.config.ts',
        'components.json',
        'CITATION.cff',
        'zenodo.json'
      ];
      
      for (const file of requiredFiles) {
        const filePath = path.join(baseDir, file);
        if (fs.existsSync(filePath)) {
          archive.file(filePath, { name: file });
        }
      }
      
      for (const file of optionalFiles) {
        const filePath = path.join(baseDir, file);
        if (fs.existsSync(filePath)) {
          archive.file(filePath, { name: file });
        }
      }
      
      // Embed Dockerfile directly (guaranteed to work)
      const dockerfile = `# PAR(2) Discovery Engine - Docker Container
FROM node:20-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM base AS builder
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Unset REPL_ID to skip Replit-specific Vite plugins during build
ENV REPL_ID=""
RUN npm run build && \\
    echo "=== Build verification ===" && \\
    ls -la dist/ && \\
    ls -la dist/public/ && \\
    test -f dist/index.cjs && \\
    test -f dist/public/index.html && \\
    echo "=== Build successful ==="

FROM base AS runner
ENV NODE_ENV=production
ENV PORT=5000
ENV HOST=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \\
 && adduser --system --uid 1001 par2user

COPY --from=builder --chown=par2user:nodejs /app/dist ./dist
COPY --from=deps --chown=par2user:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=par2user:nodejs /app/package.json ./package.json
COPY --from=builder --chown=par2user:nodejs /app/datasets ./datasets

RUN mkdir -p /app/findings_export /app/manuscripts /app/paper /app/scripts /app/data/local \\
 && chown -R par2user:nodejs /app/findings_export /app/manuscripts /app/paper /app/scripts /app/data

USER par2user
EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \\
  CMD node -e "require('http').get('http://localhost:5000/api/config', (r) => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))" || exit 1

CMD ["node", "dist/index.cjs"]
`;
      archive.append(dockerfile, { name: 'Dockerfile' });
      
      // Embed docker-compose.yml directly - with PostgreSQL like Replit
      const dockerCompose = `# PAR(2) Discovery Engine - Docker Compose
# Works exactly like the Replit version with PostgreSQL database
# Usage: docker-compose up

services:
  postgres:
    image: postgres:15-alpine
    container_name: par2-postgres
    environment:
      POSTGRES_USER: par2user
      POSTGRES_PASSWORD: CHANGE_ME_BEFORE_USE
      POSTGRES_DB: par2discovery
    volumes:
      - par2_pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U par2user -d par2discovery"]
      interval: 5s
      timeout: 5s
      retries: 5

  par2-engine:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: par2-discovery-engine
    ports:
      - "5000:5000"
    environment:
      - NODE_ENV=production
      - PORT=5000
      - HOST=0.0.0.0
      - DATABASE_URL=postgresql://par2user:CHANGE_ME_BEFORE_USE@postgres:5432/par2discovery
    depends_on:
      postgres:
        condition: service_healthy
    restart: unless-stopped

volumes:
  par2_pgdata:
`;
      archive.append(dockerCompose, { name: 'docker-compose.yml' });
      
      // Add required directories (excluding large datasets - they're 236MB!)
      const requiredDirs = [
        { src: 'server', dest: 'server' },
        { src: 'client', dest: 'client' },
        { src: 'shared', dest: 'shared' },
        { src: 'script', dest: 'script' }
      ];
      
      for (const dir of requiredDirs) {
        const dirPath = path.join(baseDir, dir.src);
        if (fs.existsSync(dirPath)) {
          archive.directory(dirPath, dir.dest);
        }
      }
      
      // Add only the dataset README and one small sample (not the full 236MB datasets)
      const datasetReadme = path.join(baseDir, 'datasets', 'README.md');
      if (fs.existsSync(datasetReadme)) {
        archive.file(datasetReadme, { name: 'datasets/README.md' });
      }
      
      // Create instructions for downloading datasets
      const datasetInstructions = `# Dataset Download Instructions

The embedded circadian datasets are not included in this package due to size (236MB).

## Download Options

### Option 1: GEO Direct Download
Download from NCBI GEO:
- GSE54650 (Hughes Circadian Atlas): https://www.ncbi.nlm.nih.gov/geo/query/acc.cgi?acc=GSE54650
- GSE157357 (Intestinal Organoids): https://www.ncbi.nlm.nih.gov/geo/query/acc.cgi?acc=GSE157357
- GSE221103 (Human Neuroblastoma): https://www.ncbi.nlm.nih.gov/geo/query/acc.cgi?acc=GSE221103

### Option 2: Use Your Own Data
The PAR(2) engine accepts CSV files with:
- First column: Gene names (symbols or Ensembl IDs)
- Remaining columns: Time points (e.g., CT0, CT4, CT8...)

### Option 3: Zenodo Archive
If available, download the complete archive from Zenodo which includes all datasets.

Place downloaded files in the \`datasets/\` directory.
`;
      archive.append(datasetInstructions, { name: 'datasets/DOWNLOAD_INSTRUCTIONS.md' });
      
      // Add optional directories if they exist
      const optionalDirs = [
        { src: 'scripts', dest: 'scripts' },
        { src: 'manuscripts', dest: 'manuscripts' },
        { src: 'findings_export', dest: 'findings_export' },
        { src: 'paper', dest: 'paper' }
      ];
      
      for (const dir of optionalDirs) {
        const dirPath = path.join(baseDir, dir.src);
        if (fs.existsSync(dirPath)) {
          archive.directory(dirPath, dir.dest);
        }
      }
      
      // Create placeholder files for optional directories (ensures Docker build works)
      archive.append('# Placeholder for findings export\n', { name: 'findings_export/.gitkeep' });
      archive.append('# Placeholder for manuscripts\n', { name: 'manuscripts/.gitkeep' });
      archive.append('# Placeholder for paper\n', { name: 'paper/.gitkeep' });
      archive.append('# Placeholder for scripts\n', { name: 'scripts/.gitkeep' });
      
      // Create empty data/local directory structure
      archive.append('', { name: 'data/local/.gitkeep' });
      
      // Create .env.example for local setup
      const envExample = `# PAR(2) Discovery Engine - Environment Configuration
# Works exactly like the Replit version with PostgreSQL database

# PostgreSQL connection (provided by docker-compose, or use your own)
DATABASE_URL=postgresql://par2user:CHANGE_ME_BEFORE_USE@postgres:5432/par2discovery

# For external database (e.g., Neon, Supabase), replace DATABASE_URL:
# DATABASE_URL=postgresql://user:password@your-host.com:5432/dbname

# Server configuration
PORT=5000
HOST=0.0.0.0
NODE_ENV=production
`;
      archive.append(envExample, { name: '.env.example' });
      
      // Create quick start script for Windows
      const windowsStart = `@echo off
echo PAR(2) Discovery Engine - Quick Start
echo =====================================
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ERROR: Node.js is not installed!
    echo Please download from https://nodejs.org
    pause
    exit /b 1
)

echo Installing dependencies...
call npm ci

echo.
echo Creating local database...
if not exist "data\\local" mkdir data\\local

echo.
echo Building application...
call npm run build

echo.
echo Setting up environment...
copy .env.example .env.local 2>nul
set STORAGE_MODE=memory

echo.
echo Starting application...
echo Open http://localhost:5000 in your browser
echo.
node dist/index.cjs

pause
`;
      archive.append(windowsStart, { name: 'start-windows.bat' });
      
      // Create quick start script for Mac/Linux
      const unixStart = `#!/bin/bash
echo "PAR(2) Discovery Engine - Quick Start"
echo "====================================="
echo

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "ERROR: Node.js is not installed!"
    echo "Please install from https://nodejs.org"
    exit 1
fi

echo "Node.js $(node -v) detected"
echo

echo "Installing dependencies..."
npm ci

echo
echo "Creating local database directory..."
mkdir -p data/local

echo
echo "Building application..."
npm run build

echo
echo "Setting up environment..."
cp .env.example .env.local 2>/dev/null || true
export STORAGE_MODE=memory

echo
echo "Starting application..."
echo "Open http://localhost:5000 in your browser"
echo
node dist/index.cjs
`;
      archive.append(unixStart, { name: 'start-mac-linux.sh' });
      
      // Docker quick start
      const dockerStart = `#!/bin/bash
# PAR(2) Discovery Engine - Docker Quick Start

echo "Starting PAR(2) Discovery Engine with Docker..."
echo

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "ERROR: Docker is not installed!"
    echo "Please install Docker from https://docker.com"
    exit 1
fi

# Build and run
docker-compose up -d

echo
echo "Application starting..."
echo "Open http://localhost:5000 in your browser"
echo
echo "To stop: docker-compose down"
`;
      archive.append(dockerStart, { name: 'start-docker.sh' });
      
      // Include a comprehensive getting started guide
      const gettingStarted = `# Getting Started with PAR(2) Discovery Engine

## Quick Start (Choose One Option)

### Option A: Docker (Easiest - Recommended)
\`\`\`bash
# On Mac/Linux:
chmod +x start-docker.sh
./start-docker.sh

# Or manually:
docker-compose up -d
\`\`\`
Then open http://localhost:5000

### Option B: Native Installation
\`\`\`bash
# On Mac/Linux:
chmod +x start-mac-linux.sh
./start-mac-linux.sh

# On Windows:
Double-click start-windows.bat
\`\`\`

The scripts will:
1. Install dependencies (npm ci)
2. Build the application (npm run build)
3. Initialize the SQLite database
4. Start the server on port 5000

### Option C: Command Line Only (No Server)
\`\`\`bash
npm ci
npx tsx scripts/local-analyze.ts datasets/GSE54650_Liver_circadian.csv --all-pairs
\`\`\`

### Option D: Manual Build
\`\`\`bash
# Install dependencies
npm ci

# Build the application  
npm run build

# Set environment variables
export STORAGE_MODE=sqlite
export SQLITE_PATH=./data/local/par2.db

# Create data directory
mkdir -p data/local

# Start the server
node dist/index.cjs
\`\`\`

## What's Included

- **12 Pre-loaded Datasets**: Mouse tissue circadian data from GSE54650
- **4 Intestinal Organoid Datasets**: Wild-type and mutant conditions from GSE157357
- **Novel Findings Manuscript**: Cell-formatted paper with compensatory gating discovery
- **Figure Generation Scripts**: R scripts for publication-ready figures
- **Complete Source Code**: Server, client, and analysis scripts

## System Requirements

- Node.js 18+ (https://nodejs.org)
- OR Docker (https://docker.com)
- 4GB RAM recommended
- 500MB disk space (1GB with node_modules)

## Key Discoveries Included

1. **Compensatory Gating**: APC mutation doubles circadian control (11% → 22%)
2. **Collapse Threshold**: Combined APC+BMAL1 mutation causes 17x collapse
3. **Tissue Signatures**: Liver protects DNA repair, Heart controls Hippo/YAP
4. **LGR5 Gating**: First report of circadian control of stem cell marker

## Troubleshooting

### Build errors
Make sure you have Node.js 18 or higher installed:
\`\`\`bash
node --version  # Should show v18.x or higher
\`\`\`

### Port already in use
Change the port:
\`\`\`bash
PORT=3000 node dist/index.cjs
\`\`\`

### Database not initializing
Ensure the data directory exists and is writable:
\`\`\`bash
mkdir -p data/local
chmod 755 data/local
\`\`\`

## Support

- See INSTALL.md for detailed installation guide
- See README.md for full documentation
- Check manuscripts/ for publication materials
- Check datasets/README.md for data format details

---
PAR(2) Discovery Engine - Circadian Gating Analysis
`;
      archive.append(gettingStarted, { name: 'GETTING_STARTED.md' });
      
      await archive.finalize();
    } catch (error) {
      console.error('Error creating portable package:', error);
      res.status(500).json({ error: 'Failed to create portable package' });
    }
  });

  // Download R scripts package for cross-validation with external tools (PASSWORD PROTECTED)
  app.get("/api/download/r-scripts/:datasetId", async (req, res) => {
    const auth = verifyDownloadPassword(req);
    if (!auth.valid) {
      return res.status(401).json({ error: auth.error, requiresPassword: true });
    }
    
    try {
      const { datasetId } = req.params;
      const archiver = await import('archiver');
      
      // Find the dataset file
      const datasetsDir = path.join(process.cwd(), 'datasets');
      const datasetFiles = fs.readdirSync(datasetsDir).filter(f => f.endsWith('.csv'));
      
      // Match dataset ID to file
      let datasetFile = datasetFiles.find(f => f.includes(datasetId));
      if (!datasetFile) {
        // Try partial match
        datasetFile = datasetFiles.find(f => 
          f.toLowerCase().includes(datasetId.toLowerCase().replace(/-/g, '_'))
        );
      }
      
      if (!datasetFile) {
        return res.status(404).json({ error: 'Dataset not found' });
      }
      
      const datasetPath = path.join(datasetsDir, datasetFile);
      const datasetName = datasetFile.replace('.csv', '').replace(/_circadian$/, '');
      
      // Read dataset to extract timepoints
      const datasetContent = fs.readFileSync(datasetPath, 'utf-8');
      const lines = datasetContent.split('\n');
      const headers = lines[0].split(',');
      
      // Extract timepoints from headers (skip first column which is gene names)
      const timepointHeaders = headers.slice(1);
      const timepoints = timepointHeaders.map((h, i) => {
        // Try to extract numeric time from header like "CT18", "ZT0", "T0", etc.
        const match = h.match(/(?:CT|ZT|T)?(\d+)/i);
        return match ? parseInt(match[1]) : i * 4;
      });
      
      // Get study name
      let studyName = "Unknown Study";
      if (datasetFile.includes('GSE54650')) studyName = "GSE54650 (Hughes Circadian Atlas)";
      else if (datasetFile.includes('GSE157357')) studyName = "GSE157357 (Intestinal Organoids)";
      else if (datasetFile.includes('GSE221103')) studyName = "GSE221103 (Neuroblastoma)";
      else if (datasetFile.includes('GSE17739')) studyName = "GSE17739 (Kidney Segments)";
      else if (datasetFile.includes('GSE59396')) studyName = "GSE59396 (Lung Inflammation)";
      
      // Get PAR(2) findings for this dataset from the diagnostic file
      const diagnosticPath = path.join(process.cwd(), 'public', 'diagnostics', 'par2_full_diagnostic.json');
      let significantFindings: any[] = [];
      let significantGenes: string[] = [];
      
      if (fs.existsSync(diagnosticPath)) {
        const diagnostic = JSON.parse(fs.readFileSync(diagnosticPath, 'utf-8'));
        const datasetResult = diagnostic.results?.find((r: any) => 
          r.datasetId?.includes(datasetId) || r.datasetName === datasetId
        );
        if (datasetResult?.topFindings) {
          significantFindings = datasetResult.topFindings;
          significantGenes = Array.from(new Set(significantFindings.map((f: any) => f.targetGene)));
        }
      }
      
      const generatedDate = new Date().toISOString().split('T')[0];
      const timepointsStr = timepoints.join(', ');
      const significantGenesStr = significantGenes.length > 0 
        ? `"${significantGenes.join('", "')}"` 
        : '"Myc", "Ccnd1", "Lgr5"';
      
      // Read R templates
      const templatesDir = path.join(process.cwd(), 'scripts', 'r-templates');
      
      const readTemplate = (filename: string): string => {
        const templatePath = path.join(templatesDir, filename);
        if (fs.existsSync(templatePath)) {
          return fs.readFileSync(templatePath, 'utf-8');
        }
        return '';
      };
      
      // Process templates
      const processTemplate = (template: string): string => {
        return template
          .replace(/\{\{DATASET_NAME\}\}/g, datasetName)
          .replace(/\{\{DATASET_ID\}\}/g, datasetId)
          .replace(/\{\{GENERATED_DATE\}\}/g, generatedDate)
          .replace(/\{\{STUDY_NAME\}\}/g, studyName)
          .replace(/\{\{INPUT_FILE\}\}/g, `data/${datasetFile}`)
          .replace(/\{\{TIMEPOINTS\}\}/g, timepointsStr)
          .replace(/\{\{SIGNIFICANT_GENES\}\}/g, significantGenesStr);
      };
      
      // Create findings table for README
      let findingsTable = "| Clock Gene | Target Gene | P-Value | Effect Size |\n";
      findingsTable += "|------------|-------------|---------|-------------|\n";
      if (significantFindings.length > 0) {
        for (const f of significantFindings.slice(0, 10)) {
          findingsTable += `| ${f.clockGene} | ${f.targetGene} | ${f.pValue?.toFixed(4) || 'N/A'} | ${f.effectSize?.toFixed(3) || 'N/A'} (${f.effectInterpretation || 'N/A'}) |\n`;
        }
      } else {
        findingsTable += "| No significant findings | - | - | - |\n";
      }
      
      const filename = generateAuditFilename('PAR2_RScripts', 'zip', { datasetName: datasetId });
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
      
      const archive = archiver.default('zip', { zlib: { level: 9 } });
      archive.pipe(res);
      
      // Add processed R scripts
      const jtkTemplate = readTemplate('jtk_cycle_template.R');
      if (jtkTemplate) {
        archive.append(processTemplate(jtkTemplate), { name: `jtk_cycle_${datasetId}.R` });
      }
      
      const metacycleTemplate = readTemplate('metacycle_template.R');
      if (metacycleTemplate) {
        archive.append(processTemplate(metacycleTemplate), { name: `metacycle_${datasetId}.R` });
      }
      
      const rainTemplate = readTemplate('rain_template.R');
      if (rainTemplate) {
        archive.append(processTemplate(rainTemplate), { name: `rain_${datasetId}.R` });
      }
      
      // Add README
      const readmeTemplate = readTemplate('README_template.md');
      if (readmeTemplate) {
        const readme = processTemplate(readmeTemplate)
          .replace(/\{\{SIGNIFICANT_FINDINGS_TABLE\}\}/g, findingsTable);
        archive.append(readme, { name: 'README.md' });
      }
      
      // Add the dataset file
      archive.file(datasetPath, { name: `data/${datasetFile}` });
      
      await archive.finalize();
    } catch (error) {
      console.error('Error creating R scripts package:', error);
      res.status(500).json({ error: 'Failed to create R scripts package' });
    }
  });

  // Download full R scripts package for all datasets (PASSWORD PROTECTED)
  app.get("/api/download/r-scripts-full", async (req, res) => {
    const auth = verifyDownloadPassword(req);
    if (!auth.valid) {
      return res.status(401).json({ error: auth.error, requiresPassword: true });
    }
    
    try {
      const archiver = await import('archiver');
      
      const filename = generateAuditFilename('PAR2_RScripts_AllDatasets', 'zip');
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
      
      const archive = archiver.default('zip', { zlib: { level: 9 } });
      archive.pipe(res);
      
      const datasetsDir = path.join(process.cwd(), 'datasets');
      const templatesDir = path.join(process.cwd(), 'scripts', 'r-templates');
      const generatedDate = new Date().toISOString().split('T')[0];
      
      // Get all dataset files
      const datasetFiles = fs.readdirSync(datasetsDir)
        .filter(f => f.endsWith('.csv') && !f.startsWith('WT_') && !f.includes('Comparison'));
      
      // Load diagnostic results
      const diagnosticPath = path.join(process.cwd(), 'public', 'diagnostics', 'par2_full_diagnostic.json');
      let diagnostic: any = { results: [] };
      if (fs.existsSync(diagnosticPath)) {
        diagnostic = JSON.parse(fs.readFileSync(diagnosticPath, 'utf-8'));
      }
      
      // Read templates once
      const jtkTemplate = fs.existsSync(path.join(templatesDir, 'jtk_cycle_template.R')) 
        ? fs.readFileSync(path.join(templatesDir, 'jtk_cycle_template.R'), 'utf-8') : '';
      const metacycleTemplate = fs.existsSync(path.join(templatesDir, 'metacycle_template.R'))
        ? fs.readFileSync(path.join(templatesDir, 'metacycle_template.R'), 'utf-8') : '';
      const rainTemplate = fs.existsSync(path.join(templatesDir, 'rain_template.R'))
        ? fs.readFileSync(path.join(templatesDir, 'rain_template.R'), 'utf-8') : '';
      
      // Process each dataset
      for (const datasetFile of datasetFiles) {
        const datasetPath = path.join(datasetsDir, datasetFile);
        const datasetId = datasetFile.replace('.csv', '').replace(/_circadian$/, '');
        const datasetName = datasetId.replace(/_/g, ' ');
        
        // Extract timepoints
        const content = fs.readFileSync(datasetPath, 'utf-8');
        const headers = content.split('\n')[0].split(',').slice(1);
        const timepoints = headers.map((h, i) => {
          const match = h.match(/(?:CT|ZT|T)?(\d+)/i);
          return match ? parseInt(match[1]) : i * 4;
        });
        
        // Get study name
        let studyName = "Unknown";
        if (datasetFile.includes('GSE54650')) studyName = "GSE54650";
        else if (datasetFile.includes('GSE157357')) studyName = "GSE157357";
        else if (datasetFile.includes('GSE221103')) studyName = "GSE221103";
        else if (datasetFile.includes('GSE17739')) studyName = "GSE17739";
        else if (datasetFile.includes('GSE59396')) studyName = "GSE59396";
        
        // Get significant genes
        const result = diagnostic.results?.find((r: any) => r.datasetId?.includes(datasetId));
        const significantGenes = result?.topFindings?.map((f: any) => f.targetGene) || [];
        const uniqueGenes = Array.from(new Set(significantGenes));
        const significantGenesStr = uniqueGenes.length > 0 
          ? `"${uniqueGenes.join('", "')}"` 
          : '"Myc", "Ccnd1", "Lgr5"';
        
        const processTemplate = (template: string): string => {
          return template
            .replace(/\{\{DATASET_NAME\}\}/g, datasetName)
            .replace(/\{\{DATASET_ID\}\}/g, datasetId)
            .replace(/\{\{GENERATED_DATE\}\}/g, generatedDate)
            .replace(/\{\{STUDY_NAME\}\}/g, studyName)
            .replace(/\{\{INPUT_FILE\}\}/g, `../data/${datasetFile}`)
            .replace(/\{\{TIMEPOINTS\}\}/g, timepoints.join(', '))
            .replace(/\{\{SIGNIFICANT_GENES\}\}/g, significantGenesStr);
        };
        
        // Add scripts for this dataset
        const folder = `${studyName}/${datasetId}`;
        if (jtkTemplate) archive.append(processTemplate(jtkTemplate), { name: `${folder}/jtk_cycle.R` });
        if (metacycleTemplate) archive.append(processTemplate(metacycleTemplate), { name: `${folder}/metacycle.R` });
        if (rainTemplate) archive.append(processTemplate(rainTemplate), { name: `${folder}/rain.R` });
        
        // Add dataset
        archive.file(datasetPath, { name: `data/${datasetFile}` });
      }
      
      // Add master README
      const masterReadme = `# PAR(2) Cross-Validation R Scripts - All Datasets

Generated: ${generatedDate}

## Overview

This package contains pre-configured R scripts for cross-validating PAR(2) findings
across all 21 embedded datasets using independent circadian analysis tools.

## Directory Structure

\`\`\`
GSE54650/           # Hughes Circadian Atlas (12 tissues)
  Adrenal/
  Aorta/
  ...
GSE157357/          # Intestinal Organoids (4 conditions)
  Organoid_WT-WT/
  Organoid_ApcKO-WT/
  ...
GSE221103/          # Neuroblastoma (2 conditions)
  Neuroblastoma_MYC_ON/
  Neuroblastoma_MYC_OFF/
GSE17739/           # Kidney Segments
GSE59396/           # Lung Inflammation
data/               # All dataset CSV files
\`\`\`

## Quick Start

\`\`\`bash
# Install R packages
Rscript -e "install.packages(c('MetaCycle', 'circacompare'))"
Rscript -e "BiocManager::install('rain')"

# Run all JTK_CYCLE analyses
find . -name "jtk_cycle.R" -exec Rscript {} \\;

# Or run a specific dataset
cd GSE54650/Liver
Rscript jtk_cycle.R
Rscript metacycle.R
Rscript rain.R
\`\`\`

## PAR(2) Batch Analysis Summary

- Total datasets: ${datasetFiles.length}
- Total pairs tested: ${diagnostic.summary?.totalPairsTested || 'N/A'}
- Bonferroni significant: ${diagnostic.summary?.totalSignificantBonf || 'N/A'}
- FDR significant: ${diagnostic.summary?.totalSignificantFDR || 'N/A'}

## Verification Workflow

1. Run JTK_CYCLE/MetaCycle to confirm clock genes are rhythmic
2. Compare results with PAR(2) findings
3. Filter out hits where clock genes aren't rhythmic
4. Cross-reference with CircaDB/CircaKB

## Resources

- CircaDB: http://circadb.hogeneschlab.org/
- MetaCycle docs: https://cran.r-project.org/package=MetaCycle
- JTK_CYCLE: https://openwetware.org/wiki/HughesLab:JTK_Cycle
`;
      archive.append(masterReadme, { name: 'README.md' });
      
      await archive.finalize();
    } catch (error) {
      console.error('Error creating full R scripts package:', error);
      res.status(500).json({ error: 'Failed to create R scripts package' });
    }
  });

  app.get("/api/paper-g/stem-cell-predictions", async (req, res) => {
    try {
      const { PREDICTION2_RESULTS, PREDICTION3_RESULTS, LGR5_ISC_SIGNATURE, WNT_HALLMARK, NOTCH_HALLMARK } = await import('../stem-cell-predictions');
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      res.json({ prediction2: PREDICTION2_RESULTS, prediction3: PREDICTION3_RESULTS, geneSets: { lgr5Isc: LGR5_ISC_SIGNATURE, wnt: WNT_HALLMARK, notch: NOTCH_HALLMARK } });
    } catch (error) {
      logger.error('Stem cell predictions error', { error: String(error) });
      res.status(500).json({ error: 'Failed to load stem cell prediction results' });
    }
  });

  app.get("/api/tcga-colorectal-validation", async (req, res) => {
    try {
      const { getTCGAColorectalValidation } = await import('../tcga-colorectal-validation');
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      res.json(getTCGAColorectalValidation());
    } catch (error) {
      logger.error('TCGA colorectal validation error', { error: String(error) });
      res.status(500).json({ error: 'Failed to generate TCGA validation' });
    }
  });

  app.get("/api/gse157357/pairwise-analysis", async (req, res) => {
    try {
      const { getGSE157357PairwiseFrontend } = await import('../gse157357-pairwise');
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      const payload = getGSE157357PairwiseFrontend();
      res.json({
        ...payload,
        temporalCoverageCaveat: "22 h ZT window (ZT24–46) — insufficient for AR(2) circadian eigenvalue analysis; ≥36 h required. All eigenvalues from this dataset are indicative only.",
      });
    } catch (error) {
      logger.error('GSE157357 pairwise analysis error', { error: String(error) });
      res.status(500).json({ error: 'Failed to generate pairwise analysis' });
    }
  });

  // ── Colas 2019 CGM AR(2) analysis ─────────────────────────────────────────
  app.get("/api/cgm-analysis/colas2019", async (req, res) => {
    try {
      const colasPath = 'manuscripts/colas2019_cgm_ar2_results.json';
      if (!fs.existsSync(colasPath)) {
        return res.status(503).json({ error: 'Colas 2019 results archive not found. Run: python3 manuscripts/scripts/colas2019_cgm_ar2_analysis.py' });
      }
      const colasData = JSON.parse(fs.readFileSync(colasPath, 'utf-8'));
      // Filter to only real Colas 2019 participants (exclude any synthetic rows)
      const realResults = (colasData.results as any[]).filter(
        (r: any) => String(r.subject).startsWith('Colas_')
      );
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      res.json({
        source: 'Colas et al. (2019) — normoglycemic adults',
        subjectCount: realResults.length,
        method: colasData.metadata?.method ?? 'AR(2) eigenvalue modulus',
        summary: colasData.summary,
        participants: realResults
          .sort((a: any, b: any) => b.modulus - a.modulus)
          .map((r: any) => ({
            subject: r.subject,
            meanGlucose: r.meanGlucose,
            cvPercent: r.cvPercent,
            modulus: r.modulus,
            r2: r.r2,
            fibonacciClass: r.fibonacciClass,
          })),
      });
    } catch (error) {
      logger.error('CGM Colas 2019 analysis error', { error: String(error) });
      res.status(500).json({ error: 'Failed to load Colas 2019 CGM results' });
    }
  });

  app.get("/api/chronotherapy-predictor", async (req, res) => {
    try {
      const { getChronotherapyDatabaseSummary } = await import('../chronotherapy-predictor');
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      res.json(getChronotherapyDatabaseSummary());
    } catch (error) {
      logger.error('Chronotherapy predictor error', { error: String(error) });
      res.status(500).json({ error: 'Failed to generate chronotherapy predictions' });
    }
  });

  app.get("/api/chronotherapy-predictor/:gene", async (req, res) => {
    try {
      const { getChronotherapyGene } = await import('../chronotherapy-predictor');
      const result = getChronotherapyGene(req.params.gene);
      if (!result) return res.status(404).json({ error: 'Gene not found in chronotherapy database' });
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      res.json(result);
    } catch (error) {
      logger.error('Chronotherapy gene lookup error', { error: String(error) });
      res.status(500).json({ error: 'Failed to lookup gene' });
    }
  });

  app.get("/api/gse157357/alternative-verification", async (req, res) => {
    try {
      const { getGSE157357AlternativeVerification } = await import('../gse157357-pairwise');
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      res.json(getGSE157357AlternativeVerification());
    } catch (error) {
      logger.error('GSE157357 alternative verification error', { error: String(error) });
      res.status(500).json({ error: 'Failed to generate alternative verification' });
    }
  });

  app.get("/api/paper-g/supplementary", async (req, res) => {
    try {
      const supplementary = {
        generated: new Date().toISOString(),
        title: "Paper G Supplementary Data — Whiteside Reply to Boman (The Fibonacci Quarterly, in press)",
        description: "Platform cross-validation results supporting Predictions 1 and 4 of the Reply paper.",
        supplementaryS1: {
          title: "S1: Genome-wide AR(2) root distribution — GSE157357 organoids (4 conditions)",
          dataset: "GSE157357",
          method: "AR(2) fitted to each gene; stability filter |r| < 1.0; mean-centred before fitting",
          notes: "Supports Prediction 1: BMAL1-KO broadens the root distribution",
          conditions: {
            "WT-WT": {
              description: "Wild-type stem cells, wild-type BMAL1 (homeostatic)",
              stableGenes: 15752,
              meanModulus: 0.4770,
              stdModulus: 0.1691,
              oscillatoryFraction: 0.744,
              highPersistenceFraction: 0.244,
              meanRootArgumentDeg: 89.0
            },
            "WT-BmalKO": {
              description: "Wild-type stem cells, BMAL1 knockout (clock disrupted)",
              stableGenes: 15655,
              meanModulus: 0.5970,
              stdModulus: 0.1942,
              oscillatoryFraction: 0.838,
              highPersistenceFraction: 0.525,
              meanRootArgumentDeg: 91.8
            },
            "ApcKO-WT": {
              description: "APC knockout (cancer model), wild-type BMAL1",
              stableGenes: 15505,
              meanModulus: 0.4852,
              stdModulus: 0.1801,
              oscillatoryFraction: 0.666,
              highPersistenceFraction: 0.274,
              meanRootArgumentDeg: 92.1
            },
            "ApcKO-BmalKO": {
              description: "APC knockout + BMAL1 knockout (double disruption)",
              stableGenes: 15239,
              meanModulus: 0.5196,
              stdModulus: 0.1918,
              oscillatoryFraction: 0.430,
              highPersistenceFraction: 0.356,
              meanRootArgumentDeg: 83.1
            }
          },
          keyFindings: [
            "BMAL1-KO raises mean |r| from 0.477 to 0.597 — clock loss increases transcriptome-wide persistence",
            "Standard deviation of |r| widens from 0.169 to 0.194 — root distribution broadens as Prediction 1 states",
            "High-persistence fraction (|r|>0.6) more than doubles: 24.4% (WT-WT) to 52.5% (BmalKO)",
            "ApcKO-BmalKO double KO collapses oscillatory fraction from 74.4% to 43.0% — qualitatively distinct from either single KO",
            "Interpretation: circadian clock acts as a transcriptome-wide damping mechanism; its loss permits longer-lived fluctuations"
          ]
        },
        supplementaryS3: {
          title: "S3: Prediction 2 — LGR5+ ISC gene set near-φ enrichment (GSE179027)",
          dataset: "GSE179027 (Mouse Enteroid, 12,302 stable genes, 24 timepoints)",
          geneSets: {
            lgr5Isc: { n: 47, source: "Munoz et al. 2012 Cell Stem Cell (PMID:22405071)", nearFibPct: 6.4, meanMod: 0.6825, enrichment: 1.05, p: 0.5579, status: "not significant" },
            wntHallmark: { n: 31, source: "MSigDB HALLMARK_WNT_BETA_CATENIN_SIGNALING v2023.1", nearFibPct: 9.7, meanMod: 0.5665, enrichment: 1.59, p: 0.2904, status: "not significant" },
            notchHallmark: { n: 24, source: "MSigDB HALLMARK_NOTCH_SIGNALING v2023.1", nearFibPct: 16.7, meanMod: 0.4687, enrichment: 2.74, p: 0.0549, status: "trending (p=0.055)" },
            combinedStem: { n: 88, nearFibPct: 8.0, meanMod: 0.6087, enrichment: 1.31, p: 0.2839, status: "not significant" },
            background: { n: 12302, nearFibPct: 6.1, meanMod: 0.4983 }
          },
          keyFindings: [
            "Prediction 2 NOT CONFIRMED: LGR5+ ISC genes show no significant near-φ enrichment (1.05×, p=0.558)",
            "NOTCH hallmark shows trending enrichment (2.74×, p=0.055) below significance threshold",
            "KEY FINDING: ISC genes have substantially elevated mean |r| (0.683 vs 0.498 background) — they are 37% more persistent than typical genes",
            "Lgr5 itself has |r|=0.948 — among the most persistent genes genome-wide — supporting stem cell identity as a high-persistence state",
            "Dll1 (Notch ligand) is the one ISC gene that IS near-φ (95.0% similarity)",
            "Most ISC genes have real (non-oscillatory) roots (89.4%), which precludes φ-specific clustering in coefficient space"
          ]
        },
        supplementaryS4: {
          title: "S4: Prediction 3 — Phase-gated coupling in stem cell regulatory network (GSE179027)",
          dataset: "GSE179027 (Mouse Enteroid, 12,302 stable genes, 24 timepoints)",
          regulatoryPairsTested: 34,
          stemCouplingRatePct: 5.9,
          randomBaselineRatePct: 10.6,
          enrichment: 0.56,
          pValue: 0.8893,
          withinSetEnrichment: { wnt: 0.53, notch: 0.67, lgr5Isc: 0.08, combined: 0.31 },
          hierarchyTest: {
            upstreamMeanMod: 0.7314, midstreamMeanMod: 0.7025, downstreamMeanMod: 0.6423,
            upstreamGenes: ["Ctnnb1","Lgr5","Axin2","Ascl2","Smoc2"],
            midstreamGenes: ["Dll1","Dll4","Notch1","Cd44","Myc","Ccnd1","Ephb2"],
            downstreamGenes: ["Mki67","Top2a","Pcna","Birc5","Ube2c","Cdc20","Cenpf","Cenpa"]
          },
          coupledPairs: [
            { src:"Dll4", tgt:"Notch1", srcMod:0.3963, tgtMod:0.3174, gap:0.079, srcRootType:"complex" },
            { src:"Chek1", tgt:"Birc5", srcMod:0.4529, tgtMod:0.3864, gap:0.066, srcRootType:"complex" }
          ],
          keyFindings: [
            "Prediction 3 NOT CONFIRMED for phase-gating: coupling enrichment = 0.56× (p=0.889, below random baseline)",
            "Mechanistic reason: most LGR5+ ISC genes have real roots — Lgr5, Myc, Dll1, Top2a all lack oscillatory dynamics — precluding phase-gating by definition",
            "|r| HIERARCHY CONFIRMED: upstream regulators (0.731) > midstream Wnt readouts (0.703) > downstream proliferation (0.642)",
            "Two phase-gated couples found: Dll4→Notch1 and Chek1→Birc5 (Notch/DNA-damage axis, not core Wnt/LGR5 hub)",
            "Interpretation: stem cell identity is maintained by high-persistence real-root dynamics (sustained state, not oscillatory phase-gating)"
          ]
        },
        supplementaryS2: {
          title: "S2: Boman-style crypt simulation → AR(2) parameter sweep",
          description: "Supports Prediction 4: Boman-like division rules with maturation delay reproduce PAR(2) signatures",
          model: {
            compartments: ["Stem cell pool (C)", "Proliferating pool (P)", "Differentiated pool (D)"],
            fibonacciMechanism: "Cohort-based TA tracking with Boman's division limit N: Fibonacci-consistent AR(2) emerges mechanistically at division_limit=2 and ta_apoptosis_rate ≈ 1/φ² ≈ 0.382. No artificial k3 parameter.",
            sweeps: 1080,
            conditions: 8,
            replicatesPerCondition: 3,
            timeSteps: 200
          },
          conditions: [
            { name: "normal", description: "Homeostatic crypt — division_limit=2 is the Fibonacci regime at ta_apoptosis_rate ≈ 0.382" },
            { name: "FAP-like", description: "APC knockout — elevated self-renewal; increased TA apoptosis breaks Fibonacci structure" },
            { name: "adenoma-like", description: "Pre-cancer — intermediate APC loss" },
            { name: "high-Wnt", description: "Elevated Wnt signalling — raised stem renewal rate" },
            { name: "low-Wnt", description: "Reduced Wnt signalling — suppressed renewal" },
            { name: "strong-delay-feedback", description: "Low transition_rate, increasing cohort residence time — tests delay sensitivity" },
            { name: "balanced-oscillator", description: "ta_apoptosis_rate near 0.382 with circadian gating — expected Fibonacci-consistent zone" },
            { name: "normal_no_circadian", description: "Homeostatic crypt without circadian gating — isolates division-limit effect" }
          ],
          keyFindings: [
            "Fibonacci-consistent AR(2) coefficients emerge mechanistically at division_limit=2 and ta_apoptosis_rate ≈ 0.382 (≈1/φ²) — no tuning required",
            "division_limit=1 produces AR(1)-like dynamics; division_limit=3 produces Lucas-like or higher-order patterns",
            "FAP-like and adenoma-like conditions show systematic deviation from the Fibonacci-consistent region",
            "Steady-state C/P and P/D ratios compared against Boman's prediction that cell ratios approach φ and 1/φ",
            "This is an exploratory conjecture, not a theorem — the sweep demonstrates empirical emergence of the φ condition",
            "Downloadable CSV files available at /boman-simulation on the platform"
          ]
        }
      };
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      res.json(supplementary);
    } catch (error) {
      logger.error('Paper G supplementary data error', { error: String(error) });
      res.status(500).json({ error: 'Failed to generate supplementary data' });
    }
  });

  app.get("/api/download/paper-n-package", async (req, res) => {
    const auth = verifyDownloadPassword(req);
    if (!auth.valid) {
      return res.status(401).json({ error: auth.error });
    }
    const ua = (req.headers['user-agent'] || '') as string;
    const ref = (req.headers['referer'] || req.headers['referrer'] || '') as string;
    const cfCountry = (req.headers['cf-ipcountry'] || '') as string;
    const isSelf = ua.includes('HeadlessChrome') || ua.includes('Headless') ||
      ref.includes('riker.replit.dev') || ref.includes('replit.com') || cfCountry === 'IE';
    storage.recordPaperDownload('paper-n-package', isSelf).catch(() => {});
    try {
      const archiver = await import('archiver');
      const archive = archiver.default('zip', { zlib: { level: 9 } });
      const timestamp = new Date().toISOString().split('T')[0];
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename=PaperN_p53_Regulon_Package_${timestamp}.zip`);
      archive.pipe(res);

      // Main manuscript (canonical source: manuscripts/paper_n_p53_CDD.*)
      const mssDir = path.join(process.cwd(), 'manuscripts');
      const pkgDir = path.join(process.cwd(), 'paper-packages', 'paper-n-p53-regulon');
      const mainMss = path.join(mssDir, 'paper_n_p53_CDD.md');
      const mainPdf = path.join(mssDir, 'paper_n_p53_CDD.pdf');
      if (fs.existsSync(mainMss)) archive.file(mainMss, { name: 'paper_n_p53_CDD.md' });
      if (fs.existsSync(mainPdf)) archive.file(mainPdf, { name: 'paper_n_p53_CDD.pdf' });
      // Cover letter and supporting files from package directory
      const pkgFiles = [
        'cover_letter.md', 'CoverLetter_CDD.pdf', 'FigureLegends.pdf',
        'TableS1_PerGene_Eigenvalues.csv',
        'Figure1_BloodDatasets_GroupMedians.png',
        'Figure2_MYC_ON_vs_OFF_PerGene.png',
        'Figure3_TP53_Trajectory.png',
        'Figure4_MouseAtlas_TissueOrdering.png',
        'generate_figures.py',
      ];
      for (const f of pkgFiles) {
        const fp = path.join(pkgDir, f);
        if (fs.existsSync(fp)) archive.file(fp, { name: f });
      }

      // Supplementary data tables
      const suppDir = path.join(process.cwd(), 'manuscripts', 'supplementary');
      const suppFiles = [
        'paper_n_table_s_nb_clock_hierarchy.csv',
        'paper_n_table_s_u2os.csv',
      ];
      for (const sf of suppFiles) {
        const sfp = path.join(suppDir, sf);
        if (fs.existsSync(sfp)) archive.file(sfp, { name: `supplementary/${sf}` });
      }

      await archive.finalize();
    } catch (error) {
      console.error('Error downloading Paper N package:', error);
      res.status(500).json({ error: 'Failed to download Paper N package' });
    }
  });

  // Paper A2 — PAR(2) Unified (QED-finalised, submission-ready)
  app.get("/api/download/paper-a2-package", async (req, res) => {
    const auth = verifyDownloadPassword(req);
    if (!auth.valid) {
      return res.status(401).json({ error: auth.error });
    }
    const ua = (req.headers['user-agent'] || '') as string;
    const ref = (req.headers['referer'] || req.headers['referrer'] || '') as string;
    const cfCountry = (req.headers['cf-ipcountry'] || '') as string;
    const isSelf = ua.includes('HeadlessChrome') || ua.includes('Headless') ||
      ref.includes('riker.replit.dev') || ref.includes('replit.com') || cfCountry === 'IE';
    storage.recordPaperDownload('paper-a2-package', isSelf).catch(() => {});
    try {
      const archiver = await import('archiver');
      const archive = archiver.default('zip', { zlib: { level: 9 } });
      const timestamp = new Date().toISOString().split('T')[0];
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename=Paper_A2_PAR2_Unified_${timestamp}.zip`);
      archive.pipe(res);

      const mssDir = path.join(process.cwd(), 'manuscripts');
      const suppDir = path.join(process.cwd(), 'manuscripts', 'supplementary');
      const pkgA   = path.join(process.cwd(), 'paper-packages', 'paper-a-core-methods');

      // Main paper
      const mainPdf = path.join(mssDir, 'paper_a2_par2_unified.pdf');
      const mainMd  = path.join(mssDir, 'paper_a2_par2_unified.md');
      if (fs.existsSync(mainPdf)) archive.file(mainPdf, { name: 'paper_a2_par2_unified.pdf' });
      if (fs.existsSync(mainMd))  archive.file(mainMd,  { name: 'paper_a2_par2_unified_source.md' });

      // Cover letter + checklist
      const covLetter = path.join(mssDir, 'cover_letter_unified.tex');
      const checklist = path.join(mssDir, 'SUBMISSION_CHECKLIST.md');
      if (fs.existsSync(covLetter)) archive.file(covLetter, { name: 'cover_letter.tex' });
      if (fs.existsSync(checklist)) archive.file(checklist, { name: 'SUBMISSION_CHECKLIST.md' });

      // References
      const refs = path.join(mssDir, 'references.bib');
      if (fs.existsSync(refs)) archive.file(refs, { name: 'references.bib' });

      // Supplementary tables
      const suppFiles: [string, string][] = [
        ['Supplementary_Table_S1b_Per_Gene_Eigenvalues.csv', path.join(pkgA, 'Supplementary_Table_S1b_Per_Gene_Eigenvalues.csv')],
        ['SupplementaryTable_S4_LiteratureValidation.csv',   path.join(suppDir, 'S4_Literature_Validation_59Genes.csv')],
        ['SupplementaryTable_S7_GeneLevelFDR.csv',           path.join(suppDir, 'SupplementaryTableS7_GeneLevelFDR.csv')],
        ['SupplementaryTable_S2_Proteomics.csv',             path.join(suppDir, 'S2_Proteomics_PAR2_Results.csv')],
        ['SupplementaryTable_S3_mRNAProteinConcordance.csv', path.join(suppDir, 'S3_mRNA_Protein_Concordance.csv')],
        ['PAR2_FALSIFIABLE_PREDICTIONS.tex',                 path.join(suppDir, 'PAR2_FALSIFIABLE_PREDICTIONS.tex')],
        ['PAR2_METHODS_VALIDATION.tex',                      path.join(suppDir, 'PAR2_METHODS_VALIDATION.tex')],
      ];
      for (const [archiveName, filePath] of suppFiles) {
        if (fs.existsSync(filePath)) archive.file(filePath, { name: `supplementary/${archiveName}` });
      }

      const readme = path.join(mssDir, 'README_SUBMISSION.md');
      if (fs.existsSync(readme)) archive.file(readme, { name: 'README_SUBMISSION.md' });

      await archive.finalize();
    } catch (error) {
      console.error('Error downloading Paper A2 package:', error);
      res.status(500).json({ error: 'Failed to download Paper A2 package' });
    }
  });

  app.post("/api/verify-paper-g-password", (req, res) => {
    const envPassword = process.env.PAPER_G_PASSWORD;
    if (!envPassword) {
      return res.status(503).json({ valid: false, error: "Paper G access is currently restricted." });
    }
    const provided = (req.body as { password?: string })?.password;
    if (!provided || provided !== envPassword) {
      return res.status(401).json({ valid: false, error: "Incorrect password." });
    }
    return res.json({ valid: true });
  });

  // Paper G2 — FQ follow-up draft (password protected — companion to in-press Paper G)
  app.get("/api/download/paper-g2-package", async (req, res) => {
    const auth = verifyDownloadPassword(req);
    if (!auth.valid) {
      return res.status(401).json({ error: auth.error });
    }
    const ua = (req.headers['user-agent'] || '') as string;
    const ref = (req.headers['referer'] || req.headers['referrer'] || '') as string;
    const cfCountry = (req.headers['cf-ipcountry'] || '') as string;
    const isSelf = ua.includes('HeadlessChrome') || ua.includes('Headless') ||
      ref.includes('riker.replit.dev') || ref.includes('replit.com') || cfCountry === 'IE';
    storage.recordPaperDownload('paper-g2-package', isSelf).catch(() => {});
    try {
      const archiver = await import('archiver');
      const archive = archiver.default('zip', { zlib: { level: 9 } });
      const timestamp = new Date().toISOString().split('T')[0];
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename=PaperG2_Fibonacci_Twinning_Draft_${timestamp}.zip`);
      archive.pipe(res);
      const mssDir = path.join(process.cwd(), 'manuscripts');
      const g2Files = [
        'paper_g2_fibonacci_twinning.md',
        'paper_g2_fibonacci_twinning.pdf',
        'paper_g2_submission.pdf',
        'paper_g2_cover_letter.pdf',
      ];
      for (const f of g2Files) {
        const fp = path.join(mssDir, f);
        if (fs.existsSync(fp)) archive.file(fp, { name: f });
      }
      await archive.finalize();
    } catch (error) {
      console.error('Error downloading Paper G2 package:', error);
      res.status(500).json({ error: 'Failed to download Paper G2 package' });
    }
  });

  app.get("/api/download/fibonacci-reply-zip", async (req, res) => {
    const envPassword = process.env.PAPER_G_PASSWORD;
    if (envPassword) {
      const provided = (req.query.password as string) || (req.headers['x-paper-g-password'] as string);
      if (!provided || provided !== envPassword) {
        return res.status(401).json({ error: "Password required for Paper G download." });
      }
    }
    const ua = (req.headers['user-agent'] || '') as string;
    const ref = (req.headers['referer'] || req.headers['referrer'] || '') as string;
    const cfCountry = (req.headers['cf-ipcountry'] || '') as string;
    const isSelf = ua.includes('HeadlessChrome') || ua.includes('Headless') ||
      ref.includes('riker.replit.dev') || ref.includes('replit.com') || cfCountry === 'IE';
    storage.recordPaperDownload('fibonacci-reply-zip', isSelf).catch(() => {});
    try {
      const archiver = await import('archiver');
      const archive = archiver.default('zip', { zlib: { level: 9 } });
      const timestamp = new Date().toISOString().split('T')[0];
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename=PaperG_Fibonacci_Reply_Amended_${timestamp}.zip`);
      archive.pipe(res);
      const pkgDir = path.join(process.cwd(), 'paper-packages', 'paper-g-fibonacci-reply');
      if (fs.existsSync(pkgDir)) {
        const files = fs.readdirSync(pkgDir);
        for (const f of files) {
          const fp = path.join(pkgDir, f);
          if (fs.statSync(fp).isFile()) archive.file(fp, { name: f });
        }
      }
      await archive.finalize();
    } catch (error) {
      console.error('Error downloading Fibonacci Reply ZIP:', error);
      res.status(500).json({ error: 'Failed to download Fibonacci Reply Package' });
    }
  });

  // Download the Reply to Boman Fibonacci Quarterly paper (password protected — accepted, in press)
  app.get("/api/download/boman-reply", async (req, res) => {
    const auth = verifyDownloadPassword(req);
    if (!auth.valid) {
      return res.status(401).json({ error: auth.error });
    }
    try {
      const replyPath = path.join(process.cwd(), 'manuscripts', 'Reply_to_Boman_FQ_2025.tex');
      
      if (!fs.existsSync(replyPath)) {
        return res.status(404).json({ error: 'Reply paper not found' });
      }
      
      const content = fs.readFileSync(replyPath, 'utf-8');
      
      const filename = generateAuditFilename('Reply_to_Boman_FQ', 'tex');
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      res.setHeader('Content-Type', 'application/x-tex; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
      
      res.send(content);
    } catch (error) {
      console.error('Error downloading Boman reply:', error);
      res.status(500).json({ error: 'Failed to download reply paper' });
    }
  });

  // Download Comprehensive Fibonacci Package (all files)

  // View individual paper manuscript PDF inline in the browser
  app.get("/api/view/paper-pdf", async (req, res) => {
    try {
      const id = req.query.id as string;

      const PDF_PATHS: Record<string, string> = {
        'methods-platform': 'paper-packages/methods-platform/PAR2_Methods_Platform_Paper.pdf',
        'paper-a':          'paper-packages/paper-a-core-methods/Paper_A_Core_Methods.pdf',
        'paper-e':          'paper-packages/paper-e-cell-systems/Paper_E_Phase_Gated_PAR2.pdf',
        'paper-f':          'paper-packages/paper-f-expression-persistence/Paper_F_Expression_Persistence.pdf',
        'fibonacci-reply':  'paper-packages/paper-g-fibonacci-reply/Paper_G_Fibonacci_Reply.pdf',
        'paper-h':          'paper-packages/paper-ad-glial/Paper_AD_Glial_Clock_Inversion.pdf',
        'paper-n':          'manuscripts/paper_n_p53_CDD.pdf',
        'paper-o':          'paper-packages/paper-o-organoid/PaperO_Organoid_Circadian_Hierarchy.pdf',
        'paper-p':          'paper-packages/paper-p-temporal-correlation/Paper_P_Temporal_Correlation.pdf',
        'paper-q':          'paper-packages/paper-q-light-entrainment/PaperQ_LightEntrainment_Manuscript.pdf',
        'paper-u':          'manuscripts/future_iterations/glds247_spaceflight_colon_submission.pdf',
        'paper-g2':         'manuscripts/paper_g2_submission.pdf',
        'paper-g2-cover':   'manuscripts/paper_g2_cover_letter.pdf',
        'paper-a2':         'manuscripts/paper_a2_par2_unified.pdf',
      };

      if (!id || !PDF_PATHS[id]) {
        return res.status(404).json({ error: 'Paper not found' });
      }

      if (id === 'fibonacci-reply') {
        const envPassword = process.env.PAPER_G_PASSWORD;
        if (envPassword) {
          const provided = (req.query.password as string) || (req.headers['x-paper-g-password'] as string);
          if (!provided || provided !== envPassword) {
            return res.status(401).send('<html><body style="font-family:sans-serif;padding:2rem"><h2>Password required</h2><p>Paper G is password protected. Please use the download page.</p></body></html>');
          }
        }
      }

      if (id === 'paper-n' || id === 'paper-u' || id === 'paper-g2' || id === 'paper-g2-cover') {
        const auth = verifyDownloadPassword(req);
        if (!auth.valid) {
          return res.status(401).send(`<html><body style="font-family:sans-serif;padding:2rem"><h2>Password required</h2><p>This manuscript is password protected. Please use the download page.</p></body></html>`);
        }
      }

      const pdfPath = path.join(process.cwd(), PDF_PATHS[id]);

      if (!fs.existsSync(pdfPath)) {
        return res.status(404).json({ error: 'PDF file not found on server' });
      }

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'inline');
      res.setHeader('Cache-Control', 'no-store, no-cache');

      const pdfBuffer = fs.readFileSync(pdfPath);
      res.send(pdfBuffer);
    } catch (error) {
      console.error('Error serving paper PDF for view:', error);
      res.status(500).json({ error: 'Failed to serve PDF' });
    }
  });
}
