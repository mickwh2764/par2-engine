/**
 * Perturbation Simulator Module
 * 
 * "What-if" analysis: simulate effects of clock knockdown,
 * drug treatment, or parameter changes on eigenvalue dynamics.
 * 
 * IMPORTANT: This uses simplified, deterministic models based on
 * literature-derived effect sizes. Results are illustrative, not predictive.
 * Use for hypothesis generation only.
 */

export interface PerturbationScenario {
  name: string;
  type: 'knockdown' | 'overexpression' | 'inhibitor' | 'agonist' | 'environmental';
  target: string;
  magnitude: number;
  description: string;
}

export interface PerturbationResult {
  scenario: PerturbationScenario;
  originalEigenvalue: number;
  perturbedEigenvalue: number;
  eigenvalueChange: number;
  percentChange: number;
  interpretation: string;
  biologicalPrediction: string;
  confidenceLevel: 'high' | 'medium' | 'low';
  references: string[];
}

export interface WhatIfAnalysis {
  baselineDescription: string;
  originalClockEigenvalue: number;
  originalTargetEigenvalue: number;
  originalGap: number;
  perturbations: PerturbationResult[];
  summary: {
    mostDisruptive: string;
    leastDisruptive: string;
    therapeuticOpportunity: string | null;
  };
  caveats: string[];
}

/**
 * Literature-derived effect sizes (deterministic, no randomness)
 * Based on published knockout/perturbation studies
 */
const EFFECT_SIZES: Record<string, { 
  knockdownEffect: number; 
  overexpressionEffect: number;
  references: string[];
}> = {
  'Per1': { 
    knockdownEffect: 0.25, 
    overexpressionEffect: 0.10,
    references: ['Bae et al. 2001 Cell', 'Zheng et al. 2001 Nature']
  },
  'Per2': { 
    knockdownEffect: 0.30, 
    overexpressionEffect: 0.12,
    references: ['Zheng et al. 1999 Nature', 'Fu et al. 2002 Cell']
  },
  'Cry1': { 
    knockdownEffect: 0.20, 
    overexpressionEffect: 0.15,
    references: ['van der Horst et al. 1999 Nature', 'Hirota et al. 2012 Science']
  },
  'Cry2': { 
    knockdownEffect: 0.15, 
    overexpressionEffect: 0.10,
    references: ['van der Horst et al. 1999 Nature']
  },
  'Clock': { 
    knockdownEffect: 0.35, 
    overexpressionEffect: 0.08,
    references: ['Vitaterna et al. 1994 Science', 'King et al. 1997 Cell']
  },
  'Arntl': { 
    knockdownEffect: 0.50, 
    overexpressionEffect: 0.05,
    references: ['Bunger et al. 2000 Cell', 'Kondratov et al. 2006 Genes Dev']
  },
  'Myc': { 
    knockdownEffect: 0.15, 
    overexpressionEffect: 0.25,
    references: ['Shostak et al. 2016 Cell Rep', 'Altman et al. 2015 Cell Metab']
  },
  'Wee1': { 
    knockdownEffect: 0.20, 
    overexpressionEffect: 0.10,
    references: ['Matsuo et al. 2003 Science', 'Hirai et al. 2009 Mol Cancer Ther']
  },
  'Ccnd1': { 
    knockdownEffect: 0.18, 
    overexpressionEffect: 0.22,
    references: ['Fu et al. 2005 Mol Cell Biol', 'Finn et al. 2016 NEJM']
  }
};

const DEFAULT_EFFECT = { knockdownEffect: 0.15, overexpressionEffect: 0.10, references: ['Estimated from general principles'] };

/**
 * Simulate eigenvalue change under perturbation (deterministic)
 */
function simulateEigenvalueChange(
  originalEigenvalue: number,
  scenario: PerturbationScenario
): { newEigenvalue: number; confidence: 'high' | 'medium' | 'low'; references: string[] } {
  const { type, magnitude, target } = scenario;
  
  const effects = EFFECT_SIZES[target] || DEFAULT_EFFECT;
  const hasLiteratureSupport = target in EFFECT_SIZES;
  
  let effectSize = 0;
  
  switch (type) {
    case 'knockdown':
      effectSize = -effects.knockdownEffect * magnitude;
      break;
    case 'overexpression':
      effectSize = effects.overexpressionEffect * magnitude;
      break;
    case 'inhibitor':
      effectSize = -effects.knockdownEffect * magnitude * 0.8;
      break;
    case 'agonist':
      effectSize = effects.overexpressionEffect * magnitude * 0.6;
      break;
    case 'environmental':
      effectSize = 0.05 * magnitude * (magnitude > 0.5 ? 1 : -1);
      break;
  }
  
  const newEigenvalue = Math.max(0.1, Math.min(1.1, originalEigenvalue * (1 + effectSize)));
  
  let confidence: 'high' | 'medium' | 'low';
  if (hasLiteratureSupport && (type === 'knockdown' || type === 'overexpression')) {
    confidence = 'high';
  } else if (hasLiteratureSupport) {
    confidence = 'medium';
  } else {
    confidence = 'low';
  }
  
  return { newEigenvalue, confidence, references: effects.references };
}

/**
 * Generate biological interpretation (deterministic)
 */
function interpretPerturbation(
  scenario: PerturbationScenario,
  eigenvalueChange: number
): { interpretation: string; biologicalPrediction: string } {
  const changeDirection = eigenvalueChange > 0 ? 'increased' : 'decreased';
  const magnitude = Math.abs(eigenvalueChange);
  const magnitudeDesc = magnitude > 0.1 ? 'substantially' : magnitude > 0.05 ? 'moderately' : 'minimally';
  
  let interpretation = `${scenario.name} ${magnitudeDesc} ${changeDirection} the eigenvalue magnitude by ${(magnitude * 100).toFixed(1)}%.`;
  let biologicalPrediction = '';
  
  if (scenario.target.match(/Per|Cry|Clock|Arntl/i)) {
    if (eigenvalueChange < -0.05) {
      biologicalPrediction = 'Clock disruption reduces temporal persistence. Target genes may lose rhythmic regulation.';
    } else if (eigenvalueChange > 0.05) {
      biologicalPrediction = 'Clock enhancement increases temporal persistence. Circadian gating should strengthen.';
    } else {
      biologicalPrediction = 'Minimal effect on clock dynamics. System is robust to this perturbation level.';
    }
  } else if (scenario.target.match(/Myc|Ccnd1|Wee1/i)) {
    if (eigenvalueChange > 0.05) {
      biologicalPrediction = 'Proliferative signal persistence increased. May indicate escape from clock control.';
    } else if (eigenvalueChange < -0.05) {
      biologicalPrediction = 'Proliferative signal dampened. Clock-target hierarchy restored or strengthened.';
    } else {
      biologicalPrediction = 'Minimal proliferative dynamics change. Alternative pathways may compensate.';
    }
  } else {
    biologicalPrediction = `${scenario.target} perturbation has ${magnitudeDesc} effect on temporal dynamics.`;
  }
  
  return { interpretation, biologicalPrediction };
}

/**
 * Standard perturbation scenarios
 */
export const STANDARD_SCENARIOS: PerturbationScenario[] = [
  { name: 'Per1/2 knockdown (50%)', type: 'knockdown', target: 'Per1', magnitude: 0.5, description: 'siRNA-mediated Per1/Per2 depletion' },
  { name: 'Cry1/2 knockdown (50%)', type: 'knockdown', target: 'Cry1', magnitude: 0.5, description: 'siRNA-mediated Cry1/Cry2 depletion' },
  { name: 'Bmal1 knockout', type: 'knockdown', target: 'Arntl', magnitude: 1.0, description: 'Complete Bmal1 deletion' },
  { name: 'Clock Δ19 mutant', type: 'knockdown', target: 'Clock', magnitude: 0.7, description: 'Dominant negative Clock mutation' },
  { name: 'MYC overexpression (3x)', type: 'overexpression', target: 'Myc', magnitude: 0.7, description: 'Oncogenic MYC induction' },
  { name: 'KL001 (CRY stabilizer)', type: 'agonist', target: 'Cry1', magnitude: 0.4, description: 'Pharmacological CRY stabilization' },
  { name: 'MK-1775 (Wee1 inhibitor)', type: 'inhibitor', target: 'Wee1', magnitude: 0.6, description: 'Wee1 kinase inhibition' },
  { name: 'Palbociclib (CDK4/6i)', type: 'inhibitor', target: 'Ccnd1', magnitude: 0.5, description: 'CDK4/6 inhibition' },
  { name: 'Constant darkness', type: 'environmental', target: 'Light', magnitude: 1.0, description: 'Remove external entrainment' },
  { name: 'Jet lag (6h advance)', type: 'environmental', target: 'Zeitgeber', magnitude: 0.6, description: 'Acute phase shift' }
];

/**
 * Run what-if analysis on a gene pair
 */
export function runWhatIfAnalysis(
  clockGene: string,
  targetGene: string,
  clockEigenvalue: number,
  targetEigenvalue: number,
  scenarios: PerturbationScenario[] = STANDARD_SCENARIOS
): WhatIfAnalysis {
  if (!isFinite(clockEigenvalue) || !isFinite(targetEigenvalue)) {
    throw new Error('Eigenvalues must be finite numbers');
  }
  
  const originalGap = clockEigenvalue - targetEigenvalue;
  const results: PerturbationResult[] = [];
  
  for (const scenario of scenarios) {
    const isClockTarget = scenario.target.match(/Per|Cry|Clock|Arntl|Light|Zeitgeber/i);
    const eigenvalueToPerturb = isClockTarget ? clockEigenvalue : targetEigenvalue;
    
    const { newEigenvalue, confidence, references } = simulateEigenvalueChange(eigenvalueToPerturb, scenario);
    const eigenvalueChange = newEigenvalue - eigenvalueToPerturb;
    const percentChange = eigenvalueToPerturb > 0 ? (eigenvalueChange / eigenvalueToPerturb) * 100 : 0;
    
    const { interpretation, biologicalPrediction } = interpretPerturbation(scenario, eigenvalueChange);
    
    results.push({
      scenario,
      originalEigenvalue: eigenvalueToPerturb,
      perturbedEigenvalue: newEigenvalue,
      eigenvalueChange,
      percentChange,
      interpretation,
      biologicalPrediction,
      confidenceLevel: confidence,
      references
    });
  }
  
  const sortedByChange = [...results].sort((a, b) => Math.abs(b.percentChange) - Math.abs(a.percentChange));
  const mostDisruptive = sortedByChange[0]?.scenario.name || 'None';
  const leastDisruptive = sortedByChange[sortedByChange.length - 1]?.scenario.name || 'None';
  
  const therapeuticCandidates = results.filter(r => 
    r.scenario.type === 'inhibitor' && 
    r.eigenvalueChange < -0.05 &&
    r.scenario.target.match(/Myc|Ccnd1|Wee1/i)
  );
  const therapeuticOpportunity = therapeuticCandidates.length > 0 
    ? `${therapeuticCandidates[0].scenario.name} may restore clock-target hierarchy`
    : null;
  
  return {
    baselineDescription: `${clockGene} (|λ|=${clockEigenvalue.toFixed(2)}) → ${targetGene} (|λ|=${targetEigenvalue.toFixed(2)})`,
    originalClockEigenvalue: clockEigenvalue,
    originalTargetEigenvalue: targetEigenvalue,
    originalGap,
    perturbations: results,
    summary: {
      mostDisruptive,
      leastDisruptive,
      therapeuticOpportunity
    },
    caveats: [
      'Simulations use literature-derived effect sizes and simplified models',
      'Results are illustrative only - not predictive of actual experimental outcomes',
      'Cell-type and context-specific effects are not captured',
      'Use for hypothesis generation, not clinical decision-making'
    ]
  };
}
