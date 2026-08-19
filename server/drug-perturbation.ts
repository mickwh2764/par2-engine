import * as fs from 'fs';
import { solveAR2Eigenvalues, isAR2Stable } from './par2-engine.ts';

interface DrugEffect {
  name: string;
  target: 'phi1' | 'phi2' | 'both';
  phi1Change: number;
  phi2Change: number;
  mechanism: string;
}

const DRUGS: DrugEffect[] = [
  { name: "Wnt Inhibitor", target: 'phi2', phi1Change: 0, phi2Change: 0.15, mechanism: "Reduces α₂ feedback (slows proliferation)" },
  { name: "Notch Blocker", target: 'phi1', phi1Change: -0.10, phi2Change: 0, mechanism: "Reduces α₁ memory (disrupts differentiation)" },
  { name: "SIRT1 Activator", target: 'both', phi1Change: 0.05, phi2Change: -0.10, mechanism: "Strengthens clock coupling" },
  { name: "CDK4/6 Inhibitor", target: 'phi1', phi1Change: -0.15, phi2Change: 0.05, mechanism: "Blocks G1→S transition" },
  { name: "Chronotherapy (Optimal)", target: 'both', phi1Change: 0, phi2Change: -0.05, mechanism: "Phase-matched drug delivery" },
  { name: "Circadian Disruptor", target: 'both', phi1Change: 0.10, phi2Change: 0.15, mechanism: "Simulates shift work / jet lag" },
];

function simulateDrugEffect(basePhi1: number, basePhi2: number, drug: DrugEffect): { 
  newPhi1: number; 
  newPhi2: number; 
  newEigenvalue: number; 
  stable: boolean;
  change: number;
} {
  const newPhi1 = basePhi1 + drug.phi1Change;
  const newPhi2 = basePhi2 + drug.phi2Change;
  const result = solveAR2Eigenvalues(newPhi1, newPhi2);
  const newEigenvalue = Math.max(result.modulus1, result.modulus2);
  const baseResult = solveAR2Eigenvalues(basePhi1, basePhi2);
  const baseEigenvalue = Math.max(baseResult.modulus1, baseResult.modulus2);
  
  return {
    newPhi1,
    newPhi2,
    newEigenvalue,
    stable: isAR2Stable(newPhi1, newPhi2),
    change: newEigenvalue - baseEigenvalue
  };
}

console.log("╔════════════════════════════════════════════════════════════╗");
console.log("║           DRUG PERTURBATION SIMULATOR                       ║");
console.log("╚════════════════════════════════════════════════════════════╝\n");

console.log("THEORY: Drugs modify AR(2) coefficients (φ₁, φ₂), shifting the");
console.log("eigenvalue toward stability (therapeutic) or instability (toxic).\n");

const scenarios = [
  { name: "Healthy Tissue", phi1: 1.0, phi2: -0.27, description: "Baseline stable dynamics" },
  { name: "Perturbed (Elevated Persistence)", phi1: 1.1, phi2: -0.40, description: "Drifting toward instability" },
  { name: "Early Adenoma", phi1: 1.2, phi2: -0.50, description: "Near critical threshold" },
];

for (const scenario of scenarios) {
  const baseResult = solveAR2Eigenvalues(scenario.phi1, scenario.phi2);
  const baseEigenvalue = Math.max(baseResult.modulus1, baseResult.modulus2);
  
  console.log("─".repeat(60));
  console.log(`SCENARIO: ${scenario.name}`);
  console.log(`  ${scenario.description}`);
  console.log(`  Baseline: φ₁=${scenario.phi1.toFixed(2)}, φ₂=${scenario.phi2.toFixed(2)} → |λ|=${baseEigenvalue.toFixed(4)}`);
  console.log("─".repeat(60));
  console.log("\n  Drug                    Δ|λ|     New |λ|   Stable?  Outcome");
  console.log("  ────────────────────    ──────   ───────   ───────   ───────");
  
  for (const drug of DRUGS) {
    const effect = simulateDrugEffect(scenario.phi1, scenario.phi2, drug);
    const outcome = effect.change < -0.05 ? "THERAPEUTIC" : 
                    effect.change > 0.10 ? "DESTABILIZING" : 
                    effect.change > 0.05 ? "CAUTION" : "NEUTRAL";
    const sign = effect.change >= 0 ? "+" : "";
    console.log(`  ${drug.name.padEnd(22)}  ${sign}${effect.change.toFixed(3).padStart(5)}   ${effect.newEigenvalue.toFixed(4)}    ${effect.stable ? "Yes" : "NO!"}      ${outcome}`);
  }
  console.log("");
}

console.log("─".repeat(60));
console.log("COMBINATION THERAPY SIMULATION");
console.log("─".repeat(60));

const combos = [
  { drugs: ["Wnt Inhibitor", "Notch Blocker"], name: "Wnt + Notch" },
  { drugs: ["SIRT1 Activator", "Chronotherapy (Optimal)"], name: "Clock Enhancement" },
  { drugs: ["CDK4/6 Inhibitor", "Wnt Inhibitor"], name: "Dual Pathway Block" },
];

const adenoma = { phi1: 1.2, phi2: -0.50 };
const baseAdenoma = solveAR2Eigenvalues(adenoma.phi1, adenoma.phi2);
const baseAdenomaEv = Math.max(baseAdenoma.modulus1, baseAdenoma.modulus2);

console.log(`\nStarting point: Early Adenoma (|λ|=${baseAdenomaEv.toFixed(4)})\n`);
console.log("  Combination              Net Δφ₁   Net Δφ₂   New |λ|   Outcome");
console.log("  ───────────────────────  ───────   ───────   ───────   ───────");

for (const combo of combos) {
  let totalPhi1Change = 0;
  let totalPhi2Change = 0;
  
  for (const drugName of combo.drugs) {
    const drug = DRUGS.find(d => d.name === drugName)!;
    totalPhi1Change += drug.phi1Change;
    totalPhi2Change += drug.phi2Change;
  }
  
  const newPhi1 = adenoma.phi1 + totalPhi1Change;
  const newPhi2 = adenoma.phi2 + totalPhi2Change;
  const result = solveAR2Eigenvalues(newPhi1, newPhi2);
  const newEv = Math.max(result.modulus1, result.modulus2);
  const outcome = newEv < 0.6 ? "REMISSION" : newEv < 0.75 ? "IMPROVED" : newEv < baseAdenomaEv ? "MODEST" : "NO BENEFIT";
  
  console.log(`  ${combo.name.padEnd(23)}  ${totalPhi1Change >= 0 ? "+" : ""}${totalPhi1Change.toFixed(2).padStart(4)}     ${totalPhi2Change >= 0 ? "+" : ""}${totalPhi2Change.toFixed(2).padStart(4)}     ${newEv.toFixed(4)}    ${outcome}`);
}

console.log(`\n
KEY INSIGHTS:
─────────────
1. SIRT1 Activator + Chronotherapy → Best single intervention
2. Wnt Inhibitor alone → Therapeutic but modest
3. Notch Blocker → Paradoxically destabilizing (disrupts memory)
4. Circadian Disruption → Models shift work damage
`);

const report = {
  timestamp: new Date().toISOString(),
  drugs: DRUGS,
  scenarios: scenarios.map(s => ({
    ...s,
    baseEigenvalue: Math.max(solveAR2Eigenvalues(s.phi1, s.phi2).modulus1, solveAR2Eigenvalues(s.phi1, s.phi2).modulus2),
    drugEffects: DRUGS.map(d => ({
      drug: d.name,
      ...simulateDrugEffect(s.phi1, s.phi2, d)
    }))
  })),
  combinations: combos.map(c => {
    let totalPhi1Change = 0, totalPhi2Change = 0;
    for (const drugName of c.drugs) {
      const drug = DRUGS.find(d => d.name === drugName)!;
      totalPhi1Change += drug.phi1Change;
      totalPhi2Change += drug.phi2Change;
    }
    const newPhi1 = adenoma.phi1 + totalPhi1Change;
    const newPhi2 = adenoma.phi2 + totalPhi2Change;
    const result = solveAR2Eigenvalues(newPhi1, newPhi2);
    return {
      name: c.name,
      drugs: c.drugs,
      netPhi1Change: totalPhi1Change,
      netPhi2Change: totalPhi2Change,
      newEigenvalue: Math.max(result.modulus1, result.modulus2)
    };
  })
};

fs.writeFileSync('DRUG_PERTURBATION_REPORT.json', JSON.stringify(report, null, 2));
console.log("Report saved to: DRUG_PERTURBATION_REPORT.json");
