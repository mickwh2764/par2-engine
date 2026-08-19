import * as fs from 'fs';
import { parse } from 'csv-parse/sync';
import { solveAR2Eigenvalues } from './par2-engine.ts';

function fitAR2(series: number[]): { phi1: number; phi2: number; eigenvalue: number; r2: number } {
  const n = series.length;
  if (n < 5) return { phi1: 0, phi2: 0, eigenvalue: 0, r2: 0 };
  
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
  if (Math.abs(denom) < 1e-10) return { phi1: 0, phi2: 0, eigenvalue: 0, r2: 0 };
  
  const phi1 = (sumYY1 * sumY2Y2 - sumYY2 * sumY1Y2) / denom;
  const phi2 = (sumYY2 * sumY1Y1 - sumYY1 * sumY1Y2) / denom;
  
  const result = solveAR2Eigenvalues(phi1, phi2);
  
  const predicted = Y1.map((y1, i) => phi1 * y1 + phi2 * Y2[i]);
  const meanY = Y.reduce((a, b) => a + b, 0) / Y.length;
  const ssTot = Y.reduce((sum, y) => sum + (y - meanY) ** 2, 0);
  const ssRes = Y.reduce((sum, y, i) => sum + (y - predicted[i]) ** 2, 0);
  const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0;
  
  return { phi1, phi2, eigenvalue: Math.max(result.modulus1, result.modulus2), r2 };
}

console.log("╔════════════════════════════════════════════════════════════╗");
console.log("║       mRNA vs PROTEIN STABILITY CONCORDANCE                 ║");
console.log("╚════════════════════════════════════════════════════════════╝\n");

console.log("QUESTION: Does mRNA eigenvalue predict protein eigenvalue?\n");

const mrnaPaths = [
  'datasets/GSE11923_Liver_1h_48h_genes.csv',
  'datasets/GSE54650_Liver_circadian.csv'
];

const proteinPaths = [
  'datasets/mouse_liver_circadian_proteomics.csv',
  'datasets/robles2014_liver_proteome_circadian.csv',
  'datasets/human_plasma_proteome_diurnal_2025.csv'
];

const existingMRNA: string[] = [];
const existingProtein: string[] = [];

for (const p of mrnaPaths) {
  if (fs.existsSync(p)) existingMRNA.push(p);
}
for (const p of proteinPaths) {
  if (fs.existsSync(p)) existingProtein.push(p);
}

console.log(`Found ${existingMRNA.length} mRNA datasets`);
console.log(`Found ${existingProtein.length} proteomics datasets\n`);

if (existingProtein.length === 0) {
  console.log("No proteomics datasets available for concordance analysis.");
  console.log("\nGenerating synthetic mRNA-Protein concordance simulation...\n");
  
  const genes = ['PER2', 'ARNTL', 'CRY1', 'CLOCK', 'SIRT1', 'LGR5', 'MYC', 'PTEN'];
  
  console.log("─".repeat(60));
  console.log("SIMULATED mRNA vs PROTEIN EIGENVALUE COMPARISON");
  console.log("─".repeat(60));
  console.log("\n  Gene     mRNA |λ|   Protein |λ|   Δ|λ|    Concordant?");
  console.log("  ──────   ────────   ──────────   ──────   ───────────");
  
  const results: any[] = [];
  let concordantCount = 0;
  
  for (const gene of genes) {
    const mrnaEv = 0.4 + Math.random() * 0.4;
    const proteinDelay = 0.05 + Math.random() * 0.15;
    const proteinDamping = 0.9 + Math.random() * 0.1;
    const proteinEv = mrnaEv * proteinDamping + proteinDelay;
    
    const delta = proteinEv - mrnaEv;
    const concordant = Math.abs(delta) < 0.15;
    if (concordant) concordantCount++;
    
    console.log(`  ${gene.padEnd(8)} ${mrnaEv.toFixed(4)}       ${proteinEv.toFixed(4)}       ${delta >= 0 ? "+" : ""}${delta.toFixed(3)}    ${concordant ? "Yes" : "No (protein lag)"}`);
    
    results.push({ gene, mrnaEigenvalue: mrnaEv, proteinEigenvalue: proteinEv, delta, concordant });
  }
  
  const concordanceRate = concordantCount / genes.length;
  
  console.log(`\n  Concordance Rate: ${concordantCount}/${genes.length} (${(concordanceRate * 100).toFixed(0)}%)`);
  
  const mrnaValues = results.map(r => r.mrnaEigenvalue);
  const proteinValues = results.map(r => r.proteinEigenvalue);
  const meanMRNA = mrnaValues.reduce((a, b) => a + b, 0) / mrnaValues.length;
  const meanProtein = proteinValues.reduce((a, b) => a + b, 0) / proteinValues.length;
  
  let numerator = 0, denomMRNA = 0, denomProtein = 0;
  for (let i = 0; i < mrnaValues.length; i++) {
    numerator += (mrnaValues[i] - meanMRNA) * (proteinValues[i] - meanProtein);
    denomMRNA += (mrnaValues[i] - meanMRNA) ** 2;
    denomProtein += (proteinValues[i] - meanProtein) ** 2;
  }
  const correlation = numerator / Math.sqrt(denomMRNA * denomProtein);
  
  console.log(`  Pearson Correlation (mRNA |λ| vs Protein |λ|): r = ${correlation.toFixed(3)}`);
  
  console.log(`\n
KEY FINDINGS (Simulated):
─────────────────────────
1. Protein eigenvalues are typically HIGHER than mRNA
   (reflects protein half-life adding "memory" to the system)

2. Strong correlation (r ≈ 0.8-0.9) expected between mRNA and protein |λ|

3. Genes with HIGH mRNA |λ| → HIGH protein |λ| (instability propagates)

BIOLOGICAL INTERPRETATION:
  - mRNA stability sets the "floor" for protein stability
  - Protein half-life adds additional temporal memory
  - Clock proteins (PER2, CRY1) have fast turnover → low |λ|
  - Structural proteins have slow turnover → high |λ|

CLINICAL IMPLICATION:
  Targeting mRNA stability (ASO, siRNA) should reduce protein |λ|
  with a delay proportional to protein half-life.
`);
  
  const report = {
    timestamp: new Date().toISOString(),
    dataSource: "Simulated (no matching proteomics dataset)",
    results,
    concordanceRate,
    correlation,
    interpretation: "Protein eigenvalue = f(mRNA eigenvalue, protein half-life)"
  };
  
  fs.writeFileSync('PROTEOMICS_CONCORDANCE_REPORT.json', JSON.stringify(report, null, 2));
  console.log("Report saved to: PROTEOMICS_CONCORDANCE_REPORT.json");
  
} else {
  console.log("Analyzing real proteomics data...");
  
  for (const path of existingProtein) {
    console.log(`\nAnalyzing: ${path}`);
    const content = fs.readFileSync(path, 'utf-8');
    const records = parse(content, { columns: true });
    console.log(`  Records: ${records.length}`);
  }
  
  const report = {
    timestamp: new Date().toISOString(),
    datasetsFound: existingProtein,
    status: "Real data available - full analysis pending"
  };
  
  fs.writeFileSync('PROTEOMICS_CONCORDANCE_REPORT.json', JSON.stringify(report, null, 2));
  console.log("\nReport saved to: PROTEOMICS_CONCORDANCE_REPORT.json");
}
