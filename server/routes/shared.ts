import type { Express, Request, Response } from "express";
import multer from "multer";
import { storage } from "../storage";
import { classifyGene as classifyGeneShared, ENSEMBL_TO_SYMBOL, resolveGeneAliases, CATEGORY_META } from "../gene-categories";
import { 
  runPAR2Analysis, 
  benjaminiHochberg, 
  solveAR2Eigenvalues,
  type GeneData, 
  type PAR2Config,
  type PAR2Result,
  GENE_SYMBOL_TO_ENSEMBL,
  ENSEMBL_TO_GENE_SYMBOL,
  resolveGeneName,
  getDisplayName,
  checkGeneAvailability,
  applyWithinPairBonferroni,
  runValidationSuite,
  assessDataQuality,
  runQuickNullSurvey,
  checkClockRhythmicity,
  runGenomeWideScreen,
  validateWithSurrogates,
  generatePhaseRandomizedSurrogate,
  runStressTest,
  type ClockRhythmicityCheck,
  type DataQualityReport,
  type NullSurveyResult,
  type GenomeWideScreenResult,
  type SurrogateValidationResult,
  type StressTestResult
} from "../par2-engine";
import { runSymmetryDebtAnalysis, type SymmetryDebtAnalysis } from "../symmetry-debt";
import { runPhaseGatingAnalysis, runExtendedPhaseGatingAnalysis } from "../phase-gating-analysis";
import { runGenomeWideCoupling } from "../genome-wide-coupling";
import { runLiteratureValidation, LITERATURE_CIRCADIAN_GENES } from "../literature-validation";
import { runPhaseVulnerabilityAnalysis, type PhaseVulnerabilityResult } from "../phase-vulnerability";
import { runBaselineBenchmark } from "../baseline-comparison";
import { runDrmrefValidation } from "../drmref-validation";
import { runBloodAnalysis, runOrganoidAnalysis } from "../drug-durability-live";
import { runDiagnosticsAnalysis } from "../ar2-diagnostics";
import { runAR1Benchmark } from "../ar1-benchmark";
import { runRhythmMatchedCoupling } from "../rhythm-matched-coupling";
import { runCancerStateSwapAnalysis } from "../cancer-state-swap";
import { runMinimalABM } from "../abm-minimal-crypt";
import { 
  runMasterAuditor, 
  runSpatialSymmetryTest,
  runTuringBenchmark,
  runFisherBenchmark,
  runNetworkBenchmark,
  runUedaBenchmark,
  analyzeTuringStability,
  analyzeInformationFidelity
} from "../benchmarks/master-auditor";
import { runMonteCarloSimulation } from "../benchmarks/monte-carlo-simulation";
import { runHeadToHeadComparison } from "../benchmarks/head-to-head-comparison";
import { runCouplingROC } from "../benchmarks/coupling-roc";
import { runP53Sensitivity } from "../p53-sensitivity";
import { runDataSparsityBenchmark, analyzeSparsityAtLevel } from "../benchmarks/data-sparsity";
import { runPhaseShiftBenchmark, analyzePhaseShift } from "../benchmarks/phase-shift";
import { generateIntegrityHash, verifyIntegrityHash, formatHashForDisplay } from "../integrity-hash";
import { computeTuringDeepDive } from "../turing-deep-dive";
import { runFairnessControlSuite } from "../crossomics-controls";
import { runBomanBridgeExperiments } from "../boman-bridge";
import { runRobustnessAnalysis } from "../robustness-analysis";
import { runFullStressTestSuite, runResidualDiagnostics, runModelComparison, runSimulationBenchmark, runAlternativeMetricsComparison } from "../stress-tests";
import { runAllExtendedModels, generateFullModelComparison } from "../ode-models-extended";
import { logger, requestLogger } from "../logger";
import { validateGeneData, validateGenePairData, calculateDataQualityMetrics, cleanGeneData } from "../validation";
import { 
  detectScale, 
  harmonizeTransform, 
  checkScaleMixing, 
  compareToRegistry, 
  getReferenceFingerprints,
  getReferenceAtlas,
  matchDatasetFingerprint,
  createFingerprint,
  type ScaleDetectionResult,
  type TransformReport,
  type DistributionFingerprint
} from "../scaleGuardrail";
import {
  analyzeODEtoAR2,
  analyzeODEtoAR2WithTheory,
  runParameterSweep,
  getHealthyParameters,
  getFAPParameters,
  getAdenomaParameters,
  BOMAN_TABLE1_DATA,
  type BomanParameters,
  type ODEtoAR2Result,
  type ParameterSweepResult
} from "../ode-boman";
import {
  compareConditions,
  analyzeVAR2,
  analyzeEigenmodes,
  linearizeBomanToVAR2,
  type VAR2Parameters,
  type VAR2Result,
  type Eigenmode
} from "../var2-statespace";
import {
  getHealthySmallboneParameters,
  getDysplasticSmallboneParameters,
  getAdenomaSmallboneParameters,
  analyzeSmallboneToAR2,
  compareSmallboneConditions,
  type SmallboneParameters
} from "../ode-smallbone";
import {
  getWntGradientParams,
  compareWntGradientConditions,
  computeWntGradientEigenvalues,
  runWntGradientSimulation
} from "../ode-wnt-gradient";
import {
  analyzeCircadianClock,
  generateModelComparisonTable,
  getDefaultParameters as getLeloupDefaultParameters,
  getDisruptedParameters as getLeloupDisruptedParameters,
  simulate as simulateLeloup,
  type LeloupAnalysisResult
} from "../ode-leloup-goldbeter";
import {
  analyzeFull19ODE,
  simulate19ODE,
  DEFAULT_LELOUP_FULL_PARAMS,
  analyzeJacobianStability,
  runMonteCarloSensitivity,
  runConstrainedMonteCarloSensitivity,
  type LeloupFull19Parameters
} from "../ode-leloup-goldbeter-full";
import {
  getAllConditions as getJohnstonConditions,
  analyzeCondition as analyzeJohnstonCondition,
  JOHNSTON_HEALTHY,
  JOHNSTON_FAP,
  JOHNSTON_ADENOMA
} from "../ode-johnston";
import {
  runNonBiologicalDataTest,
  runAdversarialSuite,
  runSamplingSensitivityTest,
  runBifurcationPointTest,
  runTissueMitoticCorrelationTest,
  runEdgeCaseStressTest,
  calculateTissueRelativeOffset,
  getTissueBaselineAtlas,
  TISSUE_BASELINE_ATLAS,
  generateRandomWalk,
  generateAR1Process,
  generateStockLike,
  generateWhiteNoise,
  generateSineWithNoise,
  fitAR2ToSeries
} from "../adversarial-tests";
import { generateReproducibilityPackage, generateMinimalDataCSV } from "../reproducibility-package";
import { computeCoreEvidence } from "../core-evidence";
import { runFullStressTestSuite as runValidationStressTestSuite, runDistributionTest, runODERoundTripValidation } from "../validation-stress-tests";
import { parse } from "csv-parse/sync";
import fs from "fs";
import path from "path";
import archiver from "archiver";
import { runEdgeCaseDiagnostics, runFullDiagnostics, runQualityChecks, computeConfidenceScore, computeGapUncertainty, computeAcf, computeLjungBox, fitAR2WithDiagnostics, type EdgeCaseDiagnostic, type QualityCheck as SharedQualityCheck, type DiagnosticsInput, type DiagnosticsResult } from "../edge-case-diagnostics";
import { getOrthologTable, getOrthologGroup, getOrthologConfidence, getOrthologSource, buildCrossSpeciesComparison, isOrthologousGene, type Species as OrthologSpecies } from "../orthology-map";

export const ALLOWED_UPLOAD_EXTENSIONS = new Set(['.csv', '.tsv', '.txt', '.json']);
export const ALLOWED_UPLOAD_MIMETYPES = new Set([
  'text/csv', 'text/tab-separated-values', 'text/plain', 'text/tsv',
  'application/csv', 'application/json',
  'application/vnd.ms-excel', // Excel saves CSVs with this type
  'application/octet-stream'  // Some browsers send this for .csv
]);

export const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB limit
  fileFilter: (_req, file, cb) => {
    const ext = '.' + (file.originalname.split('.').pop() || '').toLowerCase();
    const mimeOk = ALLOWED_UPLOAD_MIMETYPES.has(file.mimetype) || file.mimetype.startsWith('text/');
    const extOk = ALLOWED_UPLOAD_EXTENSIONS.has(ext);
    if (!mimeOk && !extOk) {
      return cb(new Error(`Invalid file type. Please upload a CSV, TSV, or TXT file.`));
    }
    cb(null, true);
  }
});

// Engine version for audit trail - update this when making significant changes to PAR(2) algorithm
export const ENGINE_VERSION = "1.3.0";

export function wrapText(text: string, font: any, fontSize: number, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';
  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const testWidth = font.widthOfTextAtSize(testLine, fontSize);
    if (testWidth > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

// All filenames use UTC timestamps of the form YYYY-MM-DDThh-mm-ssZ
export function generateAuditFilename(
  prefix: string, 
  extension: string, 
  options?: { 
    runId?: string; 
    datasetName?: string;
    includeVersion?: boolean;
  }
): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19) + 'Z';
  const version = options?.includeVersion !== false ? `v${ENGINE_VERSION}` : null;
  const shortRunId = options?.runId ? options.runId.slice(0, 8) : null;
  const safeName = options?.datasetName?.replace(/[^a-zA-Z0-9_-]/g, '_') || null;
  
  const parts = [prefix];
  if (safeName) parts.push(safeName);
  if (version) parts.push(version);
  parts.push(timestamp);
  if (shortRunId) parts.push(shortRunId);
  
  return `${parts.join('_')}.${extension}`;
}

export function sanitizePathParam(input: string): string {
  return path.basename(input).replace(/[^a-zA-Z0-9._-]/g, '_');
}

export function verifyDownloadPassword(req: Request): { valid: boolean; error?: string } {
  const envPassword = process.env.DRAFT_PAPER_PASSWORD;
  if (!envPassword) {
    return { valid: false, error: "Draft manuscript access is currently restricted." };
  }
  const provided = (req.query.password as string) || (req.headers['x-download-password'] as string);
  if (!provided) {
    return { valid: false, error: "Password required to download this draft manuscript." };
  }
  if (provided !== envPassword) {
    return { valid: false, error: "Incorrect password." };
  }
  return { valid: true };
}

// Helper function to generate explosive dynamics dataset sections
export function generateExplosiveDynamicsDatasetSections(jsonData: any, maxGenes: number = 999): string {
  let datasetSections = '';
  if (jsonData?.datasetResults) {
    for (const dataset of jsonData.datasetResults) {
      const totalUnstable = (dataset.explosiveCount || 0) + (dataset.preExplosiveCount || 0) + (dataset.boundaryCount || 0);
      
      datasetSections += `
      <div class="dataset-section">
        <h3>${dataset.dataset} <span class="dataset-type">(${dataset.type || 'Transcriptomics'})</span></h3>
        <div class="dataset-stats">
          <div class="mini-stat"><span class="val">${dataset.totalGenes?.toLocaleString()}</span><span class="lbl">Genes</span></div>
          <div class="mini-stat"><span class="val">${dataset.stableCount?.toLocaleString()}</span><span class="lbl">Stable</span></div>
          <div class="mini-stat ${dataset.boundaryCount > 0 ? 'warning' : ''}"><span class="val">${dataset.boundaryCount || 0}</span><span class="lbl">Boundary</span></div>
          <div class="mini-stat ${dataset.preExplosiveCount > 0 ? 'warning' : ''}"><span class="val">${dataset.preExplosiveCount || 0}</span><span class="lbl">Pre-Explosive</span></div>
          <div class="mini-stat ${dataset.explosiveCount > 0 ? 'danger' : ''}"><span class="val">${dataset.explosiveCount || 0}</span><span class="lbl">Explosive</span></div>
          <div class="mini-stat"><span class="val">${dataset.avgModulus?.toFixed(4) || 'N/A'}</span><span class="lbl">Avg |λ|</span></div>
          <div class="mini-stat"><span class="val">${dataset.avgFibProximity?.toFixed(2) || 'N/A'}%</span><span class="lbl">Fib Prox</span></div>
        </div>
        ${dataset.topExplosiveGenes && dataset.topExplosiveGenes.length > 0 ? `
        <table class="gene-table">
          <thead><tr><th>Gene</th><th>β₁</th><th>β₂</th><th>|λ|</th><th>Category</th><th>Fib Proximity</th><th>Mean Expr</th></tr></thead>
          <tbody>
            ${dataset.topExplosiveGenes.slice(0, maxGenes).map((g: any) => `
            <tr class="${g.category === 'Explosive' ? 'explosive-row' : g.category === 'Pre-explosive' ? 'preexplosive-row' : 'boundary-row'}">
              <td><strong>${g.gene}</strong></td>
              <td>${g.beta1?.toFixed(4)}</td>
              <td>${g.beta2?.toFixed(4)}</td>
              <td><strong>${g.modulus?.toFixed(4)}</strong></td>
              <td>${g.category}</td>
              <td>${g.fibProximity?.toFixed(2)}%</td>
              <td>${g.meanExpr?.toFixed(2)}</td>
            </tr>`).join('')}
          </tbody>
        </table>
        ` : '<p class="no-unstable">No unstable genes detected in this dataset (healthy baseline)</p>'}
      </div>`;
    }
  }
  return datasetSections;
}

// Helper to load explosive dynamics JSON data
export function loadExplosiveDynamicsData(): any {
  const jsonPath = path.join(process.cwd(), 'manuscripts', 'explosive_dynamics_analysis.json');
  return fs.existsSync(jsonPath) ? JSON.parse(fs.readFileSync(jsonPath, 'utf-8')) : null;
}

export const CANDIDATES = [
  // Wnt/Stem Cell Pathway
  { name: "Myc", role: "Proliferation Driver", id: "ENSMUSG00000022346", category: "Wnt/Proliferation" },
  { name: "Ccnd1", role: "Cell Cycle G1/S", id: "ENSMUSG00000070348", category: "Cell Cycle" },
  { name: "Lgr5", role: "Stem Cell Marker", id: "ENSMUSG00000020140", category: "Wnt/Stem Cell" },
  { name: "Axin2", role: "Wnt Reporter", id: "ENSMUSG00000021669", category: "Wnt/Proliferation" },
  // Cell Cycle Regulators
  { name: "Cdkn1a", role: "p21/Cell Cycle Inhibitor", id: "ENSMUSG00000023067", category: "Cell Cycle" },
  { name: "Ccnb1", role: "Cyclin B1/G2-M", id: "ENSMUSG00000041431", category: "Cell Cycle" },
  { name: "Cdk1", role: "CDK1/Mitosis Driver", id: "ENSMUSG00000019461", category: "Cell Cycle" },
  { name: "Wee1", role: "G2/M Checkpoint", id: "ENSMUSG00000031016", category: "Cell Cycle" },
  // DNA Damage Response
  { name: "Tp53", role: "Tumor Suppressor", id: "ENSMUSG00000059552", category: "DNA Repair" },
  { name: "Mdm2", role: "p53 Regulator", id: "ENSMUSG00000020184", category: "DNA Repair" },
  { name: "Atm", role: "DNA Damage Sensor", id: "ENSMUSG00000034218", category: "DNA Repair" },
  { name: "Chek2", role: "Checkpoint Kinase", id: "ENSMUSG00000029521", category: "DNA Repair" },
  // Apoptosis/Survival
  { name: "Bcl2", role: "Anti-Apoptotic", id: "ENSMUSG00000000489", category: "Apoptosis" },
  { name: "Bax", role: "Pro-Apoptotic", id: "ENSMUSG00000003873", category: "Apoptosis" },
  { name: "Birc5", role: "Survivin/Anti-Apoptotic", id: "ENSMUSG00000017716", category: "Survival" },
  // Metabolism
  { name: "Hif1a", role: "Hypoxia Response", id: "ENSMUSG00000021109", category: "Metabolism" },
  { name: "Pparg", role: "Lipid Metabolism", id: "ENSMUSG00000000440", category: "Metabolism" },
  { name: "Sirt1", role: "NAD+ Sensor", id: "ENSMUSG00000020063", category: "Metabolism" },
  // Hippo/YAP Pathway
  { name: "Yap1", role: "Hippo Effector", id: "ENSMUSG00000027277", category: "Hippo/YAP" },
  { name: "Tead1", role: "YAP Co-activator", id: "ENSMUSG00000026064", category: "Hippo/YAP" },
  // Oncofetal Reprogramming (Nguyen et al. 2025 - therapy resistance markers)
  { name: "Clu", role: "Revival Stem Cell Marker", id: "ENSMUSG00000022037", category: "Oncofetal" },
  { name: "Tacstd2", role: "Trop2/Fetal Progenitor", id: "ENSMUSG00000025613", category: "Oncofetal" },
  { name: "Ly6a", role: "Sca-1/Stem Cell", id: "ENSMUSG00000075602", category: "Oncofetal" },
  { name: "Anxa1", role: "Regenerative CSC", id: "ENSMUSG00000020566", category: "Oncofetal" },
  { name: "Sox2", role: "Pluripotency Factor", id: "ENSMUSG00000074637", category: "Oncofetal" },
  { name: "Sox9", role: "Progenitor/Metastasis", id: "ENSMUSG00000000567", category: "Oncofetal" },
  { name: "H19", role: "lncRNA/EMT Driver", id: "ENSMUSG00000000031", category: "Oncofetal" },
  { name: "Igf2bp1", role: "IMP1/mRNA Stabilizer", id: "ENSMUSG00000060546", category: "Oncofetal" },
  { name: "Wwtr1", role: "TAZ/YAP Paralog", id: "ENSMUSG00000027803", category: "Oncofetal" },
  { name: "Fosl1", role: "Fra-1/AP-1 Member", id: "ENSMUSG00000024912", category: "Oncofetal" },
  // stTrace Morphological Markers (spatial transcriptomics)
  { name: "Cox6c", role: "Metabolic/Mitochondrial", id: "ENSMUSG00000058315", category: "Metabolism" },
  { name: "Mgp", role: "Structural/ECM", id: "ENSMUSG00000030218", category: "Structural" },
  { name: "Fasn", role: "Lipid Synthesis", id: "ENSMUSG00000025153", category: "Metabolism" },
  { name: "Erbb2", role: "RTK/Oncogene", id: "ENSMUSG00000062312", category: "Signaling" },
  { name: "Pten", role: "Tumor Suppressor/PI3K", id: "ENSMUSG00000013663", category: "Signaling" }
];

export const CLOCKS = [
  { name: "Per2", role: "Negative Limb", id: "ENSMUSG00000023473" },
  { name: "Arntl", role: "Positive Limb/BMAL1", id: "ENSMUSG00000020875" },
  { name: "Clock", role: "Core Activator", id: "ENSMUSG00000029238" },
  { name: "Per1", role: "Negative Limb", id: "ENSMUSG00000020893" },
  { name: "Cry1", role: "Cryptochrome/Negative", id: "ENSMUSG00000020038" },
  { name: "Cry2", role: "Cryptochrome/Negative", id: "ENSMUSG00000068742" },
  { name: "Nr1d1", role: "Rev-Erb Alpha", id: "ENSMUSG00000020889" },
  { name: "Nr1d2", role: "Rev-Erb Beta", id: "ENSMUSG00000021775" }
];

// Arabidopsis thaliana clock genes for cross-species PAR(2) analysis
// Extended July 2025: RVE4/6/8 (morning MYB TFs) and LNK1/2 (evening scaffolds) added
// based on Qin et al. 2025 Nat Commun 16:4171 snRNA-seq pseudo-bulk validation (17-gene panel).
// ABF1 added as candidate circadian regulator (Qin et al. 2025 functional validation).
export const ARABIDOPSIS_CLOCKS = [
  { name: "CCA1", role: "Morning Element", id: "AT2G46830" },
  { name: "LHY", role: "Morning Element", id: "AT1G01060" },
  { name: "TOC1", role: "Evening Element/PRR1", id: "AT5G61380" },
  { name: "PRR7", role: "Sequential Repressor", id: "AT5G02810" },
  { name: "PRR5", role: "Sequential Repressor", id: "AT5G24470" },
  { name: "PRR9", role: "Sequential Repressor", id: "AT2G46790" },
  { name: "GI", role: "Evening Regulator", id: "AT1G22770" },
  { name: "ELF3", role: "Evening Complex", id: "AT2G25930" },
  { name: "ELF4", role: "Evening Complex", id: "AT2G40080" },
  { name: "LUX", role: "Evening Complex/LBS", id: "AT3G46640" },
  { name: "RVE4", role: "Morning MYB / RVE activator", id: "AT5G02840", source: "Qin et al. 2025" },
  { name: "RVE6", role: "Morning MYB / RVE activator", id: "AT5G52660", source: "Qin et al. 2025", note: "marginally non-stationary in bulk (|λ|≈1.03); interpret with caution" },
  { name: "RVE8", role: "Morning MYB / RVE activator", id: "AT3G09600", source: "Qin et al. 2025" },
  { name: "LNK1", role: "Evening Scaffold / RVE8 co-activator", id: "AT5G64170", source: "Qin et al. 2025" },
  { name: "LNK2", role: "Evening Scaffold / RVE8 co-activator", id: "AT3G54500", source: "Qin et al. 2025" },
  { name: "ABF1", role: "Candidate Regulator (bZIP/ABA)", id: "AT1G49720", source: "Qin et al. 2025", note: "overexpression shortens period; candidate status pending wider replication" },
];

// Arabidopsis target genes for circadian-regulated processes
export const ARABIDOPSIS_TARGETS = [
  { name: "CAB1", role: "Photosynthesis", id: "AT1G29930", category: "Light Harvesting" },
  { name: "FT", role: "Florigen", id: "AT1G65480", category: "Flowering" },
  { name: "PHYA", role: "Light Receptor", id: "AT1G09570", category: "Photoreceptor" },
  { name: "PHYB", role: "Light Receptor", id: "AT2G18790", category: "Photoreceptor" },
  { name: "CRY1", role: "Blue Light Receptor", id: "AT4G08920", category: "Photoreceptor" },
  { name: "CRY2", role: "Blue Light Receptor", id: "AT1G04400", category: "Photoreceptor" },
  { name: "ZTL", role: "Clock Input", id: "AT5G57360", category: "Clock Regulation" },
  { name: "PRR3", role: "PRR Family", id: "AT1G32060", category: "Clock Regulation" }
];

// Helper to detect organism from dataset name
export function detectOrganism(datasetName: string): 'mouse' | 'human' | 'plant' | 'unknown' {
  if (datasetName.includes('Arabidopsis') || datasetName.includes('GSE242964')) return 'plant';
  if (datasetName.includes('GSE19271') || datasetName.includes('GSE37278')) return 'plant';
  if (datasetName.includes('Qin2025') || datasetName.includes('snRNAseq_pseudobulk')) return 'plant';
  if (datasetName.includes('Human_Blood') || datasetName.includes('GSE48113')) return 'human';
  if (datasetName.includes('GSE122541') || datasetName.includes('GSE39445') || datasetName.includes('GSE113883')) return 'human';
  if (datasetName.includes('human') || datasetName.includes('Human') || datasetName.includes('Neuroblastoma')) return 'human';
  if (datasetName.includes('GSE54650') || datasetName.includes('GSE157357') || datasetName.includes('mouse') || datasetName.includes('Mouse')) return 'mouse';
  return 'unknown';
}

// Get appropriate clock genes for a dataset
export function getClocksForDataset(datasetName: string) {
  const organism = detectOrganism(datasetName);
  return organism === 'plant' ? ARABIDOPSIS_CLOCKS : CLOCKS;
}

// Get appropriate target genes for a dataset
export function getTargetsForDataset(datasetName: string) {
  const organism = detectOrganism(datasetName);
  return organism === 'plant' ? ARABIDOPSIS_TARGETS : CANDIDATES;
}

// Consolidated gene panel helper for all analysis workflows
interface GenePanel {
  clocks: typeof CLOCKS;
  targets: typeof CANDIDATES;
  defaultPairs: { target: string; clock: string }[];
  organism: 'mouse' | 'human' | 'plant' | 'unknown';
}

export function getGenePanel(datasetName?: string): GenePanel {
  const organism = datasetName ? detectOrganism(datasetName) : 'mouse';
  
  if (organism === 'plant') {
    return {
      clocks: ARABIDOPSIS_CLOCKS,
      targets: ARABIDOPSIS_TARGETS,
      defaultPairs: [
        { target: "CAB1", clock: "CCA1" },
        { target: "CAB1", clock: "TOC1" },
        { target: "FT", clock: "GI" },
        { target: "FT", clock: "CCA1" },
        { target: "PHYA", clock: "CCA1" },
        { target: "PHYB", clock: "TOC1" },
        { target: "CRY1", clock: "LHY" },
        { target: "ZTL", clock: "GI" }
      ],
      organism: 'plant'
    };
  }
  
  return {
    clocks: CLOCKS,
    targets: CANDIDATES,
    defaultPairs: DEFAULT_PAIRS,
    organism: organism
  };
}

export const DEFAULT_PAIRS = [
  // Core Wnt-Clock interactions
  { target: "Myc", clock: "Per2" },
  { target: "Ccnd1", clock: "Per2" },
  { target: "Lgr5", clock: "Per2" },
  { target: "Axin2", clock: "Arntl" },
  { target: "Myc", clock: "Arntl" },
  // Cell cycle-clock interactions
  { target: "Wee1", clock: "Per2" },
  { target: "Cdkn1a", clock: "Arntl" },
  // DNA repair timing
  { target: "Tp53", clock: "Per2" },
  // Metabolism-clock
  { target: "Sirt1", clock: "Clock" }
];

export function getAllPairs(datasetName?: string): { target: string; clock: string }[] {
  const pairs: { target: string; clock: string }[] = [];
  const clocks = datasetName ? getClocksForDataset(datasetName) : CLOCKS;
  const targets = datasetName ? getTargetsForDataset(datasetName) : CANDIDATES;
  for (const candidate of targets) {
    for (const clock of clocks) {
      pairs.push({ target: candidate.name, clock: clock.name });
    }
  }
  return pairs;
}

// Get organism-specific DEFAULT_PAIRS for plant datasets
export function getDefaultPairs(datasetName?: string): { target: string; clock: string }[] {
  if (datasetName && detectOrganism(datasetName) === 'plant') {
    return [
      { target: "CAB1", clock: "CCA1" },
      { target: "CAB1", clock: "TOC1" },
      { target: "FT", clock: "GI" },
      { target: "FT", clock: "CCA1" },
      { target: "PHYA", clock: "CCA1" },
      { target: "PHYB", clock: "TOC1" },
      { target: "CRY1", clock: "LHY" },
      { target: "ZTL", clock: "GI" }
    ];
  }
  return DEFAULT_PAIRS;
}

// Helper function to apply FDR correction to all hypotheses in a run
export async function applyFDRCorrectionToRun(runId: string, threshold: number = 0.05): Promise<{ significantBeforeFDR: number; significantAfterFDR: number }> {
  const hypotheses = await storage.getHypothesesByRunId(runId);
  
  // Filter hypotheses with valid p-values (not 1.0 = gene not found)
  const validHypotheses = hypotheses.filter(h => h.pValue !== null && h.pValue < 1.0);
  
  if (validHypotheses.length === 0) {
    return { significantBeforeFDR: 0, significantAfterFDR: 0 };
  }
  
  // Extract p-values and compute FDR
  const pValues = validHypotheses.map(h => h.pValue as number);
  const { qValues, significant } = benjaminiHochberg(pValues, threshold);
  
  // Update each hypothesis with its q-value
  for (let i = 0; i < validHypotheses.length; i++) {
    await storage.updateHypothesisFDR(validHypotheses[i].id, qValues[i], significant[i]);
  }
  
  // Also update hypotheses without valid p-values (gene not found cases)
  const invalidHypotheses = hypotheses.filter(h => h.pValue === null || h.pValue >= 1.0);
  for (const hyp of invalidHypotheses) {
    await storage.updateHypothesisFDR(hyp.id, 1.0, false);
  }
  
  const significantBeforeFDR = hypotheses.filter(h => h.significant).length;
  const significantAfterFDR = significant.filter(s => s).length;
  
  logger.analysis('FDR correction applied', {
    runId,
    significantBeforeFDR,
    significantAfterFDR,
    threshold
  });
  
  return { significantBeforeFDR, significantAfterFDR };
}

export interface ParsedDataset {
  timepoints: number[];
  geneTimeSeries: Map<string, number[]>;
  geneIds: string[];
  format: 'gene-rows' | 'time-rows';
}

export async function parseDatasetBuffer(buffer: Buffer, fileName: string): Promise<ParsedDataset> {
  let content: string;
  
  if (fileName.endsWith('.gz')) {
    const { promisify } = await import('util');
    const zlib = await import('zlib');
    const gunzip = promisify(zlib.gunzip);
    const decompressed = await gunzip(buffer);
    content = decompressed.toString('utf-8');
  } else {
    content = buffer.toString('utf-8');
  }

  const delimiter = fileName.endsWith('.tsv') ? '\t' : ',';
  
  const records = parse(content, {
    columns: false,
    skip_empty_lines: true,
    delimiter,
    relax_column_count: true
  }) as string[][];

  if (records.length < 2) {
    throw new Error("Dataset must have at least a header row and one data row");
  }

  const headerRow = records[0];
  
  // Detect format: gene-rows (standard) vs time-rows
  // Gene-row format: first column is gene ID, rest are timepoints (CT0, CT4, ZT0, etc.)
  // Time-row format: first column is timepoint, rest are gene IDs
  
  const firstHeader = headerRow[0]?.toLowerCase() || '';
  const secondHeader = headerRow[1]?.toLowerCase() || '';
  
  // Check if headers look like timepoints (CT, ZT, X##hr, or numeric, or contains CT/ZT in name)
  const looksLikeTimepoint = (s: string) => 
    /^(ct|zt|t|time|x\d)/i.test(s) || /^\d+$/.test(s.replace('.', '')) || /hr$/i.test(s) ||
    /_CT\d|_ZT\d|circadian/i.test(s);
  
  // If second column header looks like a timepoint, it's gene-rows format
  const isGeneRowFormat = looksLikeTimepoint(secondHeader) || 
    headerRow.slice(1).some(h => looksLikeTimepoint(h));

  const geneTimeSeries = new Map<string, number[]>();
  let timepoints: number[] = [];
  const geneIds: string[] = [];

  if (isGeneRowFormat) {
    // GENE-ROWS FORMAT (standard): rows = genes, columns = timepoints
    // Header: [GeneID/empty, CT0, CT4, CT8, ...] or [GeneID, 0, 4, 8, ...]
    
    // Parse timepoints from header
    timepoints = headerRow.slice(1).map((h, i) => {
      const numMatch = h.match(/(\d+)/);
      return numMatch ? parseFloat(numMatch[1]) : i;
    });

    // Parse each gene row
    for (let i = 1; i < records.length; i++) {
      const row = records[i];
      const geneId = row[0]?.trim();
      if (!geneId) continue;
      
      geneIds.push(geneId);
      const expressionValues = row.slice(1).map(v => parseFloat(v) || 0);
      geneTimeSeries.set(geneId, expressionValues);
    }

    // Average biological replicates (duplicate timepoints) across all genes
    const uniqueTpSet = Array.from(new Set(timepoints)).sort((a, b) => a - b);
    if (uniqueTpSet.length < timepoints.length) {
      const avgTimeSeries = new Map<string, number[]>();
      for (const geneId of geneIds) {
        const vals = geneTimeSeries.get(geneId) ?? [];
        const grouped = new Map<number, number[]>();
        for (let i = 0; i < timepoints.length; i++) {
          const t = timepoints[i];
          if (!grouped.has(t)) grouped.set(t, []);
          grouped.get(t)!.push(vals[i] ?? 0);
        }
        avgTimeSeries.set(geneId, uniqueTpSet.map(t => {
          const g = grouped.get(t) ?? [0];
          return g.reduce((a, b) => a + b, 0) / g.length;
        }));
      }
      return { timepoints: uniqueTpSet, geneTimeSeries: avgTimeSeries, geneIds, format: 'gene-rows' };
    }

    return { timepoints, geneTimeSeries, geneIds, format: 'gene-rows' };
  } else {
    // TIME-ROWS FORMAT: rows = timepoints, columns = genes
    // Header: [Time, Gene1, Gene2, ...]
    
    const geneHeaders = headerRow.slice(1);
    geneHeaders.forEach(g => geneIds.push(g));
    
    // Initialize empty arrays for each gene
    geneHeaders.forEach(geneId => {
      geneTimeSeries.set(geneId, []);
    });

    // Parse each timepoint row
    for (let i = 1; i < records.length; i++) {
      const row = records[i];
      const timepoint = parseFloat(row[0]) || i - 1;
      timepoints.push(timepoint);
      
      for (let j = 1; j < row.length && j - 1 < geneHeaders.length; j++) {
        const geneId = geneHeaders[j - 1];
        const value = parseFloat(row[j]) || 0;
        geneTimeSeries.get(geneId)?.push(value);
      }
    }

    // Average biological replicates (duplicate timepoints) across all genes
    const uniqueTpSetTR = Array.from(new Set(timepoints)).sort((a, b) => a - b);
    if (uniqueTpSetTR.length < timepoints.length) {
      const avgTimeSeries = new Map<string, number[]>();
      for (const geneId of geneIds) {
        const vals = geneTimeSeries.get(geneId) ?? [];
        const grouped = new Map<number, number[]>();
        for (let i = 0; i < timepoints.length; i++) {
          const t = timepoints[i];
          if (!grouped.has(t)) grouped.set(t, []);
          grouped.get(t)!.push(vals[i] ?? 0);
        }
        avgTimeSeries.set(geneId, uniqueTpSetTR.map(t => {
          const g = grouped.get(t) ?? [0];
          return g.reduce((a, b) => a + b, 0) / g.length;
        }));
      }
      return { timepoints: uniqueTpSetTR, geneTimeSeries: avgTimeSeries, geneIds, format: 'time-rows' };
    }

    return { timepoints, geneTimeSeries, geneIds, format: 'time-rows' };
  }
}

export function generateMockData(period: number = 24): ParsedDataset {
  const timepoints = Array.from({ length: 25 }, (_, i) => i);
  const allGenes = [...CANDIDATES, ...CLOCKS];
  const geneIds = allGenes.map(g => g.id);
  
  const geneTimeSeries = new Map<string, number[]>();
  
  allGenes.forEach((gene, idx) => {
    const phaseShift = (idx * Math.PI) / 3;
    const amplitude = 0.5 + Math.random() * 0.3;
    const mean = 5 + Math.random() * 2;
    
    const values = timepoints.map(t => {
      const noise = (Math.random() - 0.5) * 0.2;
      return mean + amplitude * Math.cos(2 * Math.PI * t / period + phaseShift) + noise;
    });
    
    geneTimeSeries.set(gene.id, values);
  });

  return { timepoints, geneTimeSeries, geneIds, format: 'gene-rows' };
}

// Re-exports needed by sub-route files
export { classifyGeneShared, ENSEMBL_TO_SYMBOL, resolveGeneAliases, CATEGORY_META };
export {
  runPAR2Analysis,
  benjaminiHochberg,
  solveAR2Eigenvalues,
  GENE_SYMBOL_TO_ENSEMBL,
  ENSEMBL_TO_GENE_SYMBOL,
  resolveGeneName,
  getDisplayName,
  checkGeneAvailability,
  applyWithinPairBonferroni,
  runValidationSuite,
  assessDataQuality,
  runQuickNullSurvey,
  checkClockRhythmicity,
  runGenomeWideScreen,
  validateWithSurrogates,
  generatePhaseRandomizedSurrogate,
  runStressTest
};
