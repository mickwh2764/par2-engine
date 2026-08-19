import * as fs from 'fs';
import { parse } from 'csv-parse/sync';
import { solveAR2Eigenvalues } from './par2-engine.ts';

function fitAR2(series: number[]): { phi1: number; phi2: number; eigenvalue: number } {
  const n = series.length;
  const Y = series.slice(2);
  const Y1 = series.slice(1, n - 1);
  const Y2 = series.slice(0, n - 2);
  
  let sumY1Y1 = 0, sumY2Y2 = 0, sumY1Y2 = 0, sumYY1 = 0, sumYY2 = 0;
  for (let i = 0; i < Y.length; i++) {
    sumY1Y1 += Y1[i] * Y1[i];
    sumY2Y2 += Y2[i] * Y2[i];
    sumY1Y2 += Y1[i] * Y2[i];
    sumYY1 += Y[i] * Y1[i];
    sumYY2 += Y[i] * Y2[i];
  }
  
  const denom = sumY1Y1 * sumY2Y2 - sumY1Y2 * sumY1Y2;
  const phi1 = (sumYY1 * sumY2Y2 - sumYY2 * sumY1Y2) / denom;
  const phi2 = (sumYY2 * sumY1Y1 - sumYY1 * sumY1Y2) / denom;
  
  const result = solveAR2Eigenvalues(phi1, phi2);
  return { phi1, phi2, eigenvalue: Math.max(result.modulus1, result.modulus2) };
}

function computeRecoveryThreshold(eigenvalue: number, targetRecovery: number = 0.99): number {
  if (eigenvalue >= 1) return Infinity;
  if (eigenvalue <= 0) return 0;
  return Math.log(1 - targetRecovery) / Math.log(eigenvalue);
}

function computeHalfLife(eigenvalue: number): number {
  if (eigenvalue >= 1) return Infinity;
  if (eigenvalue <= 0) return 0;
  return Math.log(0.5) / Math.log(eigenvalue);
}

console.log("╔════════════════════════════════════════════════════════════╗");
console.log("║       CRITICAL RECOVERY THRESHOLD CALCULATOR               ║");
console.log("╚════════════════════════════════════════════════════════════╝\n");

console.log("THEORY: After a perturbation (jet lag, injury, drug), how many");
console.log("generations until the system returns to baseline?\n");
console.log("Formula: N = log(1 - recovery%) / log(|λ|)\n");

console.log("─".repeat(60));
console.log("REFERENCE TABLE: Recovery Time by Eigenvalue");
console.log("─".repeat(60));

// Real data from Jan 2026 audit: Target genes=0.537, Clock genes=0.689
const eigenvalues = [0.30, 0.40, 0.537, 0.60, 0.689, 0.80, 0.90, 0.95, 0.99];
console.log("\n  |λ|    Half-life   90% Recovery   99% Recovery   Status");
console.log("  ────   ─────────   ────────────   ────────────   ──────");

for (const ev of eigenvalues) {
  const halfLife = computeHalfLife(ev);
  const recovery90 = computeRecoveryThreshold(ev, 0.90);
  const recovery99 = computeRecoveryThreshold(ev, 0.99);
  const status = ev < 0.6 ? "Resilient" : ev < 0.8 ? "Moderate" : ev < 0.95 ? "Fragile" : "Critical";
  console.log(`  ${ev.toFixed(2)}    ${halfLife.toFixed(1).padStart(5)} gen    ${recovery90.toFixed(1).padStart(6)} gen     ${recovery99.toFixed(1).padStart(6)} gen     ${status}`);
}

console.log("\n─".repeat(60));
console.log("TISSUE-SPECIFIC RECOVERY ESTIMATES");
console.log("─".repeat(60));

// Real data from Jan 2026 audit
const tissues = [
  { name: "Healthy Colon", eigenvalue: 0.537, cycleHours: 24 },  // Target gene baseline
  { name: "Clock Gene Level", eigenvalue: 0.689, cycleHours: 24 },  // Clock gene baseline
  { name: "APC-Mutant Colon", eigenvalue: 0.70, cycleHours: 24 },
  { name: "Adenoma", eigenvalue: 0.95, cycleHours: 24 },
  { name: "Human Blood", eigenvalue: 0.376, cycleHours: 4 },  // Blood mean from audit
];

console.log("\n  Tissue              |λ|    99% Recovery    Time (days)");
console.log("  ──────────────────  ────   ────────────    ───────────");

for (const t of tissues) {
  const generations = computeRecoveryThreshold(t.eigenvalue, 0.99);
  const days = (generations * t.cycleHours) / 24;
  console.log(`  ${t.name.padEnd(20)}  ${t.eigenvalue.toFixed(2)}   ${generations.toFixed(1).padStart(6)} gen       ${days.toFixed(1).padStart(5)} days`);
}

console.log("\n─".repeat(60));
console.log("CLINICAL IMPLICATIONS");
console.log("─".repeat(60));

console.log(`
  Real data from Jan 2026 audit (33 datasets):
  - Target genes: mean=0.537±0.232
  - Clock genes: mean=0.689±0.203
  
  HEALTHY TISSUE (|λ| ≈ 0.537 target gene baseline):
    - Recovers from jet lag in ~8 cell generations (~8 days)
    - Can tolerate repeated perturbations
    
  MODERATE PERSISTENCE (|λ| ≈ 0.70):
    - Recovery takes ~13 generations (~13 days)
    - Chronic stress compounds before recovery completes
    
  HIGH PERSISTENCE/CRITICAL (|λ| ≈ 0.95):
    - Recovery takes ~90+ generations (~90 days)
    - Effectively loses circadian memory permanently
    
  DISEASE PATTERN:
    - Already at critical threshold in healthy tissue
    - May explain why Tuft hyperplasia is early cancer marker
`);

const report = {
  timestamp: new Date().toISOString(),
  referenceTable: eigenvalues.map(ev => ({
    eigenvalue: ev,
    halfLife: computeHalfLife(ev),
    recovery90: computeRecoveryThreshold(ev, 0.90),
    recovery99: computeRecoveryThreshold(ev, 0.99)
  })),
  tissueEstimates: tissues.map(t => ({
    ...t,
    generationsTo99: computeRecoveryThreshold(t.eigenvalue, 0.99),
    daysTo99: (computeRecoveryThreshold(t.eigenvalue, 0.99) * t.cycleHours) / 24
  }))
};

fs.writeFileSync('RECOVERY_THRESHOLD_REPORT.json', JSON.stringify(report, null, 2));
console.log("Report saved to: RECOVERY_THRESHOLD_REPORT.json");
