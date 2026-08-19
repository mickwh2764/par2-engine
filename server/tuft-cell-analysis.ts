import * as fs from 'fs';
import { parse } from 'csv-parse/sync';
import { solveAR2Eigenvalues } from './par2-engine.ts';

function getGeneTimeSeries(file: string, geneId: string): number[] {
  const content = fs.readFileSync(file, 'utf-8');
  const records = parse(content, { columns: true });
  const row = records.find((r: any) => r.target_id === geneId);
  if (!row) return [];
  return Object.values(row).slice(1).map((v: any) => parseFloat(v)).filter(v => !isNaN(v));
}

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

console.log("=== TUFT CELL (Dclk1) CIRCADIAN ANALYSIS ===\n");

const DCLK1 = "ENSMUSG00000020238";

const wtFile = "datasets/GSE157357_Organoid_WT-WT_circadian.csv";
const apcFile = "datasets/GSE157357_Organoid_ApcKO-WT_circadian.csv";

const wtDclk1 = getGeneTimeSeries(wtFile, DCLK1);
const apcDclk1 = getGeneTimeSeries(apcFile, DCLK1);

if (wtDclk1.length > 0) {
  const wtResult = fitAR2(wtDclk1);
  console.log("WILD-TYPE ORGANOIDS:");
  console.log(`  Dclk1 (Tuft marker) |λ| = ${wtResult.eigenvalue.toFixed(4)}`);
  console.log(`  φ₁ = ${wtResult.phi1.toFixed(4)}, φ₂ = ${wtResult.phi2.toFixed(4)}`);
  console.log(`  Mean expression: ${(wtDclk1.reduce((a,b) => a+b, 0) / wtDclk1.length).toFixed(2)} TPM`);
  console.log(`  Status: ${wtResult.eigenvalue < 0.75 ? "STABLE" : "DRIFTING"}\n`);
} else {
  console.log("Dclk1 not found in WT organoids\n");
}

if (apcDclk1.length > 0) {
  const apcResult = fitAR2(apcDclk1);
  console.log("APC-KNOCKOUT ORGANOIDS:");
  console.log(`  Dclk1 (Tuft marker) |λ| = ${apcResult.eigenvalue.toFixed(4)}`);
  console.log(`  φ₁ = ${apcResult.phi1.toFixed(4)}, φ₂ = ${apcResult.phi2.toFixed(4)}`);
  console.log(`  Mean expression: ${(apcDclk1.reduce((a,b) => a+b, 0) / apcDclk1.length).toFixed(2)} TPM`);
  console.log(`  Status: ${apcResult.eigenvalue < 0.75 ? "STABLE" : "DRIFTING"}\n`);
} else {
  console.log("Dclk1 not found in APC-KO organoids\n");
}

if (wtDclk1.length > 0 && apcDclk1.length > 0) {
  const wtE = fitAR2(wtDclk1).eigenvalue;
  const apcE = fitAR2(apcDclk1).eigenvalue;
  const drift = apcE - wtE;
  console.log("=== COMPARISON ===");
  console.log(`  WT |λ|:     ${wtE.toFixed(4)}`);
  console.log(`  APC-KO |λ|: ${apcE.toFixed(4)}`);
  console.log(`  Drift:      ${drift > 0 ? "+" : ""}${drift.toFixed(4)}`);
  console.log(`\n  Interpretation: ${
    drift > 0.15 ? "Tuft cells DESTABILIZED in cancer model" : 
    drift < -0.15 ? "Tuft cells show PROTECTIVE stabilization" : 
    "Minimal change in Tuft cell dynamics"
  }`);
}

const report = {
  timestamp: new Date().toISOString(),
  gene: "Dclk1",
  role: "Tuft cell marker",
  wildType: wtDclk1.length > 0 ? fitAR2(wtDclk1) : null,
  apcKnockout: apcDclk1.length > 0 ? fitAR2(apcDclk1) : null
};
fs.writeFileSync('TUFT_CELL_ANALYSIS.json', JSON.stringify(report, null, 2));
console.log("\nReport saved to: TUFT_CELL_ANALYSIS.json");
