export const GENE_COLORS = [
  '#22d3ee',
  '#a855f7',
  '#f472b6',
  '#4ade80',
  '#fb923c',
  '#facc15',
  '#60a5fa',
  '#f87171',
];

export const CLOCK_COLORS: Record<string, string> = {
  'Per2': '#22d3ee',
  'Arntl': '#a855f7',
  'Clock': '#f472b6', 
  'Per1': '#4ade80',
  'Cry1': '#fb923c',
  'Cry2': '#facc15',
  'Nr1d1': '#60a5fa',
  'Nr1d2': '#f87171',
};

export const TARGET_COLORS: Record<string, string> = {
  'Myc': '#f472b6',
  'Ccnd1': '#4ade80',
  'Lgr5': '#fb923c',
  'Axin2': '#facc15',
  'Cdkn1a': '#22d3ee',
  'Ccnb1': '#a855f7',
  'Cdk1': '#60a5fa',
  'Wee1': '#f87171',
  'Tp53': '#34d399',
  'Mdm2': '#c084fc',
  'Atm': '#fbbf24',
  'Chek2': '#38bdf8',
  'Bcl2': '#fb7185',
  'Bax': '#a3e635',
  'Hif1a': '#e879f9',
  'Pparg': '#2dd4bf',
  'Sirt1': '#fcd34d',
  'Yap1': '#818cf8',
  'Tead1': '#f97316',
};

export interface ConfidenceInterval {
  term: string;
  coefficient: number;
  lower: number;
  upper: number;
}

export interface ClockRhythmicityCheck {
  isRhythmic: boolean;
  pValue: number;
  amplitude: number;
  relativeAmplitude: number;
  peakTime: number;
  rSquared: number;
  warning: string | null;
}

export interface DataQualityWarnings {
  sampleSizeWarning: string | null;
  clockRhythmicityWarning: string | null;
  dataQualityScore: 'good' | 'acceptable' | 'poor';
}

export interface Hypothesis {
  id: string;
  runId: string;
  targetGene: string;
  targetRole: string;
  clockGene: string;
  clockRole: string;
  significant: boolean;
  pValue: number;
  qValue?: number | null;
  significantAfterFDR?: boolean;
  significantTerms: string[];
  description: string;
  fdrAdjustedPValue?: number | null;
  modelQuality?: 'high' | 'medium' | 'low';
  effectSizeCohensF2?: number | null;
  effectSizeInterpretation?: string | null;
  rSquaredChange?: number | null;
  confidenceIntervals?: ConfidenceInterval[] | null;
  clockRhythmicity?: ClockRhythmicityCheck | null;
  dataQuality?: DataQualityWarnings | null;
  nTimepoints?: number | null;
}

export interface AnalysisRun {
  id: string;
  name: string;
  datasetName: string;
  status: string;
  createdAt: string;
  completedAt?: string;
}

export interface Config {
  candidates: Array<{ name: string; role: string; id: string; category?: string }>;
  clocks: Array<{ name: string; role: string; id: string }>;
  pairs: Array<{ target: string; clock: string }>;
}

export interface DatasetInfo {
  fileName: string;
  rowCount: number;
  geneCount: number;
  timepoints: number[];
  availableGenes: string[];
  previewData: Array<{ time: number; [gene: string]: number }>;
}

export interface EmbeddedDataset {
  id: string;
  filename: string;
  study: string;
  tissue: string;
  condition?: string | null;
  description: string;
}

export interface ProteomicsRun {
  id: string;
  name: string;
  datasetName: string;
  dataType: string;
  status: string;
  linkedTranscriptomicsRunId?: string | null;
  createdAt: string;
  completedAt?: string | null;
}

export interface ProteomicsResult {
  id: string;
  runId: string;
  targetProtein: string;
  targetGeneSymbol: string;
  clockProtein: string;
  clockGeneSymbol: string;
  significant: boolean;
  pValue: number | null;
  qValue?: number | null;
  significantAfterFDR?: boolean;
  significantTerms: string[];
  effectSizeCohensF2?: number | null;
  effectSizeInterpretation?: string | null;
  rSquaredChange?: number | null;
  confidenceIntervals?: ConfidenceInterval[] | null;
}

export interface ConcordanceResult {
  id: string;
  transcriptomicsRunId: string;
  proteomicsRunId: string;
  targetGene: string;
  clockGene: string;
  mrnaPValue: number | null;
  mrnaSignificant: boolean;
  proteinPValue: number | null;
  proteinSignificant: boolean;
  concordanceStatus: 'both_significant' | 'mrna_only' | 'protein_only' | 'neither';
  interpretation: string;
}

export interface CrossTissuePair {
  targetGene: string;
  clockGene: string;
  tissuesAnalyzed: number;
  tissuesSignificant: number;
  tissuesSignificantFDR: number;
  significantTissues: string[];
  consensusScore: number;
  meanPValue: number;
  meanEffectSize: number;
  confidenceTier: 'HIGH' | 'MEDIUM' | 'LOW' | 'EXPLORATORY';
}

export interface GatingCentrality {
  targetGene: string;
  totalClockGenes: number;
  significantClockGenes: number;
  clockGeneList: string[];
  centralityScore: number;
  totalSignificantPairs: number;
  meanEffectSize: number;
  isCriticalNode: boolean;
}

export interface CrossTissueConsensusData {
  summary: {
    totalTissuesAnalyzed: number;
    tissueNames: string[];
    totalGenePairs: number;
    highConfidenceCount: number;
    criticalNodeCount: number;
    tierBreakdown: {
      HIGH: number;
      MEDIUM: number;
      LOW: number;
      EXPLORATORY: number;
    };
  };
  highConfidencePairs: CrossTissuePair[];
  allPairs: CrossTissuePair[];
  gatingCentrality: GatingCentrality[];
  methodology: {
    description: string;
    confidenceTiers: Record<string, string>;
    gatingCentrality: string;
  };
}

export interface MethodComparisonData {
  available: boolean;
  message?: string;
  runId?: string;
  hypothesisId?: string;
  datasetName?: string;
  par2?: {
    clockGene: string;
    targetGene: string;
    pValue: number | null;
    fdr: number | null;
    effectSize: number | null;
    isSignificant: boolean;
    rSquaredChange: number | null;
  };
  cosinor?: {
    clock: {
      amplitude: number;
      phase: number;
      r2: number;
      pValue: number;
      isRhythmic: boolean;
    } | null;
    target: {
      amplitude: number;
      phase: number;
      r2: number;
      pValue: number;
      isRhythmic: boolean;
    } | null;
  };
  confidence?: {
    level: 'HIGH' | 'MEDIUM' | 'LOW';
    label: string;
    explanation: string;
    par2Specific: boolean;
  };
}

export interface EigenvaluePoint {
  real: number;
  imag: number;
  modulus: number;
  label?: string;
  isStable: boolean;
  inBand: boolean;
}

export interface CoefficientPoint {
  beta1: number;
  beta2: number;
  label?: string;
  isStable: boolean;
  inBand: boolean;
}

export interface NetworkNode {
  id: string;
  name: string;
  type: 'clock' | 'target';
  color: string;
  connections: number;
}

export interface NetworkLink {
  source: string;
  target: string;
  pValue: number;
  fdrSignificant: boolean;
  effectSize: string;
}
