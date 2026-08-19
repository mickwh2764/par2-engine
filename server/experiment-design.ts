/**
 * Experiment Design Helper Module
 * 
 * Generates actionable experimental recommendations based on PAR(2) findings.
 * Suggests perturbations, sampling schedules, and validation approaches.
 */

export interface ExperimentDesign {
  targetGene: string;
  clockGene: string;
  tissuesFound: string[];
  recommendedPerturbations: Perturbation[];
  samplingSchedule: SamplingSchedule;
  controlConditions: string[];
  expectedOutcome: string;
  validationApproaches: ValidationApproach[];
  estimatedCost: CostEstimate;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface Perturbation {
  type: 'genetic' | 'pharmacological' | 'environmental';
  name: string;
  description: string;
  targetMechanism: string;
  expectedEffect: string;
  references: string[];
}

export interface SamplingSchedule {
  intervalHours: number;
  totalDurationHours: number;
  timepoints: number[];
  criticalWindows: { start: number; end: number; reason: string }[];
  minimumReplicates: number;
}

export interface ValidationApproach {
  method: string;
  description: string;
  dataRequired: string[];
  difficulty: 'easy' | 'medium' | 'hard';
}

export interface CostEstimate {
  tier: 'low' | 'medium' | 'high';
  description: string;
  estimatedWeeks: number;
}

const GENE_PERTURBATIONS: Record<string, Perturbation[]> = {
  'Per1': [
    { type: 'genetic', name: 'Per1 knockout', description: 'CRISPR-Cas9 Per1 deletion', targetMechanism: 'Remove negative feedback component', expectedEffect: 'Dampened oscillation, altered period', references: ['Bae et al. 2001 Cell'] },
    { type: 'pharmacological', name: 'PER stabilizer', description: 'Proteasome inhibitor (MG132)', targetMechanism: 'Reduce PER degradation', expectedEffect: 'Extended PER accumulation phase', references: ['Yoo et al. 2013 PNAS'] }
  ],
  'Per2': [
    { type: 'genetic', name: 'Per2 knockout', description: 'CRISPR-Cas9 Per2 deletion', targetMechanism: 'Core clock disruption', expectedEffect: 'Arrhythmic behavior, metabolic changes', references: ['Zheng et al. 1999 Nature'] },
    { type: 'environmental', name: 'Light pulse', description: 'Phase-shifting light exposure at CT15', targetMechanism: 'Per2 acute induction', expectedEffect: 'Phase delay of circadian rhythm', references: ['Albrecht et al. 2001'] }
  ],
  'Cry1': [
    { type: 'genetic', name: 'Cry1 knockout', description: 'CRISPR-Cas9 Cry1 deletion', targetMechanism: 'Weaken negative feedback', expectedEffect: 'Shortened circadian period (~22h)', references: ['van der Horst et al. 1999 Nature'] },
    { type: 'pharmacological', name: 'KL001', description: 'CRY stabilizer compound', targetMechanism: 'Inhibit FBXL3-mediated CRY degradation', expectedEffect: 'Lengthened period, enhanced amplitude', references: ['Hirota et al. 2012 Science'] }
  ],
  'Clock': [
    { type: 'genetic', name: 'Clock mutant', description: 'Clock Δ19 dominant negative', targetMechanism: 'Disrupt CLOCK:BMAL1 heterodimer', expectedEffect: 'Lengthened period, reduced amplitude', references: ['Vitaterna et al. 1994 Science'] }
  ],
  'Arntl': [
    { type: 'genetic', name: 'Bmal1 knockout', description: 'Tissue-specific Bmal1 deletion', targetMechanism: 'Abolish core clock function', expectedEffect: 'Complete arrhythmicity', references: ['Bunger et al. 2000 Cell'] }
  ],
  'Myc': [
    { type: 'genetic', name: 'MYC overexpression', description: 'Tet-On MYC induction', targetMechanism: 'Oncogenic transformation', expectedEffect: 'Clock-target hierarchy disruption', references: ['Shostak et al. 2016'] },
    { type: 'pharmacological', name: 'MYC inhibitor', description: '10058-F4 or Omomyc', targetMechanism: 'Block MYC:MAX dimerization', expectedEffect: 'Restore clock control of proliferation', references: ['Yin et al. 2003'] }
  ],
  'Wee1': [
    { type: 'pharmacological', name: 'MK-1775 (Adavosertib)', description: 'Wee1 kinase inhibitor', targetMechanism: 'Force premature mitosis', expectedEffect: 'Mitotic catastrophe in S-phase', references: ['Hirai et al. 2009 Mol Cancer Ther'] },
    { type: 'genetic', name: 'Wee1 knockdown', description: 'siRNA or shRNA Wee1 depletion', targetMechanism: 'Reduce G2/M checkpoint', expectedEffect: 'Increased mitotic entry rate', references: ['Watanabe et al. 2004'] }
  ],
  'Ccnd1': [
    { type: 'pharmacological', name: 'Palbociclib', description: 'CDK4/6 inhibitor', targetMechanism: 'Block Cyclin D1-CDK4 activity', expectedEffect: 'G1 arrest, reduced proliferation', references: ['Finn et al. 2016 NEJM'] }
  ],
  'Pparg': [
    { type: 'pharmacological', name: 'Rosiglitazone', description: 'PPARγ agonist (thiazolidinedione)', targetMechanism: 'Activate PPARγ transcription', expectedEffect: 'Enhanced adipogenesis, insulin sensitivity', references: ['Lehmann et al. 1995'] },
    { type: 'pharmacological', name: 'GW9662', description: 'PPARγ antagonist', targetMechanism: 'Block PPARγ activity', expectedEffect: 'Reduced adipogenic differentiation', references: ['Leesnitzer et al. 2002'] }
  ]
};

function getSamplingSchedule(geneType: 'clock' | 'target', tissueType: string): SamplingSchedule {
  const baseSchedule: SamplingSchedule = {
    intervalHours: 4,
    totalDurationHours: 48,
    timepoints: [0, 4, 8, 12, 16, 20, 24, 28, 32, 36, 40, 44, 48],
    criticalWindows: [],
    minimumReplicates: 3
  };

  if (geneType === 'clock') {
    baseSchedule.criticalWindows = [
      { start: 8, end: 16, reason: 'PER/CRY protein accumulation peak' },
      { start: 20, end: 24, reason: 'BMAL1:CLOCK transcription peak' }
    ];
  } else {
    baseSchedule.criticalWindows = [
      { start: 4, end: 12, reason: 'Proliferative gene expression window' },
      { start: 16, end: 20, reason: 'Clock-gated transition period' }
    ];
  }

  if (tissueType.toLowerCase().includes('liver')) {
    baseSchedule.criticalWindows.push({ start: 12, end: 16, reason: 'Hepatic circadian metabolism peak' });
  }

  return baseSchedule;
}

function getValidationApproaches(targetGene: string, clockGene: string): ValidationApproach[] {
  const approaches: ValidationApproach[] = [
    {
      method: 'Time-course qPCR',
      description: `Measure ${targetGene} and ${clockGene} expression every 4h for 48h`,
      dataRequired: ['RNA samples', 'Primer sets', '3+ biological replicates'],
      difficulty: 'easy'
    },
    {
      method: 'ChIP-seq for BMAL1 binding',
      description: `Assess BMAL1 occupancy at ${targetGene} promoter across circadian cycle`,
      dataRequired: ['BMAL1 ChIP-grade antibody', 'Sequencing capacity', 'Bioinformatics'],
      difficulty: 'medium'
    },
    {
      method: 'Luciferase reporter',
      description: `${targetGene} promoter-luciferase for real-time oscillation tracking`,
      dataRequired: ['Reporter construct', 'Luminometer', 'Continuous monitoring'],
      difficulty: 'medium'
    },
    {
      method: 'Western blot time-course',
      description: `Protein-level confirmation of ${targetGene} rhythmicity`,
      dataRequired: ['Specific antibody', 'Time-course lysates'],
      difficulty: 'easy'
    }
  ];

  if (['Wee1', 'Ccnd1', 'Myc'].includes(targetGene)) {
    approaches.push({
      method: 'Flow cytometry cell cycle',
      description: 'Measure cell cycle distribution at peak vs trough of clock gene',
      dataRequired: ['Propidium iodide', 'Flow cytometer', 'Synchronized cells'],
      difficulty: 'medium'
    });
  }

  return approaches;
}

function estimateCost(perturbations: Perturbation[], validation: ValidationApproach[]): CostEstimate {
  const hasGenetic = perturbations.some(p => p.type === 'genetic');
  const hasHardValidation = validation.some(v => v.difficulty === 'hard');

  if (hasGenetic || hasHardValidation) {
    return { tier: 'high', description: 'Requires genetic modification or specialized equipment', estimatedWeeks: 12 };
  } else if (perturbations.length > 2) {
    return { tier: 'medium', description: 'Multiple conditions with standard assays', estimatedWeeks: 6 };
  }
  return { tier: 'low', description: 'Standard pharmacological + qPCR validation', estimatedWeeks: 3 };
}

export function generateExperimentDesign(
  targetGene: string,
  clockGene: string,
  tissues: string[],
  par2Significance: boolean = true
): ExperimentDesign {
  const targetPerturbations = GENE_PERTURBATIONS[targetGene] || [];
  const clockPerturbations = GENE_PERTURBATIONS[clockGene] || [];
  
  const allPerturbations = [...targetPerturbations.slice(0, 2), ...clockPerturbations.slice(0, 1)];
  
  if (allPerturbations.length === 0) {
    allPerturbations.push({
      type: 'environmental',
      name: 'Constant darkness',
      description: 'Free-running conditions to test endogenous rhythm',
      targetMechanism: 'Remove external entrainment',
      expectedEffect: 'Reveal intrinsic clock-target relationship',
      references: ['Standard chronobiology protocol']
    });
  }

  const validation = getValidationApproaches(targetGene, clockGene);
  const schedule = getSamplingSchedule('target', tissues[0] || 'liver');
  const cost = estimateCost(allPerturbations, validation);

  return {
    targetGene,
    clockGene,
    tissuesFound: tissues,
    recommendedPerturbations: allPerturbations,
    samplingSchedule: schedule,
    controlConditions: [
      'Vehicle-treated controls (same solvent/concentration)',
      'Time-matched sampling (same ZT across conditions)',
      'Wild-type littermates (for genetic perturbations)',
      `Housekeeping gene normalization (Gapdh, Actb, B2m)`
    ],
    expectedOutcome: par2Significance
      ? `If ${clockGene} gates ${targetGene}, perturbation should alter the phase relationship and/or magnitude of ${targetGene} oscillation`
      : `Exploratory analysis to determine if ${clockGene}-${targetGene} relationship exists`,
    validationApproaches: validation,
    estimatedCost: cost,
    priority: par2Significance ? 'HIGH' : 'LOW'
  };
}

export function generateBatchDesigns(
  pairs: Array<{ target: string; clock: string; tissues: string[]; significant: boolean }>
): ExperimentDesign[] {
  return pairs.map(p => generateExperimentDesign(p.target, p.clock, p.tissues, p.significant));
}
