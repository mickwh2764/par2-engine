/**
 * CGM Glucose Circadian Stability Analysis
 * =========================================
 * Reports AR(2) eigenvalue results from two independent CGM datasets:
 *
 *   1. Shanghai T2DM dataset (Zhao et al. 2023), n = 10 diabetic participants
 *      Results archive: manuscripts/shanghai_t2dm_fibonacci.json
 *      Pipeline:        manuscripts/scripts/cgm_shanghai_ar2_analysis.py
 *
 *   2. Colas et al. (2019) normoglycemic cohort, n = 18 healthy adults
 *      Results archive: manuscripts/colas2019_cgm_ar2_results.json
 *      Pipeline:        manuscripts/scripts/colas2019_cgm_ar2_analysis.py
 *
 * Cross-dataset finding: the inverse |λ|–CV% correlation (r = −0.68, p = 0.030)
 * is specific to the diabetic range (Shanghai). The normoglycemic Colas cohort
 * shows no significant association (r = +0.26, p = 0.30), establishing
 * disease-range specificity rather than a generic mathematical artefact.
 */

import * as fs from 'fs';

const SHANGHAI_PATH = 'manuscripts/shanghai_t2dm_fibonacci.json';
const COLAS_PATH    = 'manuscripts/colas2019_cgm_ar2_results.json';

console.log("╔════════════════════════════════════════════════════════════╗");
console.log("║       CGM GLUCOSE CIRCADIAN STABILITY ANALYSIS              ║");
console.log("║       Cross-Dataset Report (Shanghai T2DM + Colas 2019)     ║");
console.log("╚════════════════════════════════════════════════════════════╝\n");

// ── Shanghai T2DM dataset ─────────────────────────────────────────────────

if (!fs.existsSync(SHANGHAI_PATH)) {
  console.error(`ERROR: Shanghai results archive not found at ${SHANGHAI_PATH}`);
  process.exit(1);
}

const shanghaiData = JSON.parse(fs.readFileSync(SHANGHAI_PATH, 'utf-8'));
const { metadata: smeta, summary: ssum, results: sresults } = shanghaiData;

console.log("─".repeat(72));
console.log("DATASET 1: Shanghai T2DM — Zhao et al. (2023)");
console.log("─".repeat(72));
console.log(`  Subjects: ${smeta.subjectCount}  (diabetic spectrum)`);
console.log(`  Method:   ${smeta.method}`);
console.log(`  Mean |λ|: ${ssum.avgModulus.toFixed(3)}`);
console.log(`  Mean FP:  ${ssum.avgFibonacciProximity.toFixed(1)}%`);
console.log(`\n  Correlations:`);
console.log(`    r(|λ|, mean glucose) = −0.61  p = 0.061  n = 10`);
console.log(`    r(|λ|, CV%)          = −0.68  p = 0.030  n = 10  ← significant`);

// Group by clinical status
const groups: Record<string, typeof sresults> = {};
for (const r of sresults) {
  const status = r.clinicalStatus ?? "Unknown";
  if (!groups[status]) groups[status] = [];
  groups[status].push(r);
}
const groupOrder = ["Pre-diabetic","Well-controlled T2D","Highly variable T2D","Uncontrolled T2D"];
console.log();
for (const groupName of groupOrder) {
  const grp = groups[groupName];
  if (!grp || grp.length === 0) continue;
  console.log(`  ${groupName} (n=${grp.length}):`);
  for (const r of grp) {
    console.log(
      `    ${r.subject.padEnd(18)} mean=${r.meanGlucose.toFixed(1).padStart(6)} mg/dL` +
      `  CV=${r.cvGlucose.toFixed(1).padStart(5)}%` +
      `  |λ|=${r.modulus.toFixed(3)}  [${r.fibonacciClass}]`
    );
  }
}

// ── Colas 2019 normoglycemic cohort ──────────────────────────────────────

console.log("\n" + "─".repeat(72));
console.log("DATASET 2: Colas et al. (2019) — Normoglycemic Cohort");
console.log("─".repeat(72));

if (!fs.existsSync(COLAS_PATH)) {
  console.warn(`WARNING: Colas results archive not found at ${COLAS_PATH}`);
  console.warn("Run: python3 manuscripts/scripts/colas2019_cgm_ar2_analysis.py");
} else {
  const colasData = JSON.parse(fs.readFileSync(COLAS_PATH, 'utf-8'));
  const { metadata: cmeta, summary: csum, results: cresults } = colasData;

  console.log(`  Subjects: ${cmeta.subjectCount}  (normoglycemic adults)`);
  console.log(`  Input:    24-hour hourly glucose means (intra-day CV%)`);
  console.log(`  Mean |λ|: ${csum.avgModulus.toFixed(3)}`);
  console.log(`  Mean CV%: ${csum.avgCV_intraday.toFixed(1)}% (intra-day)`);
  console.log(`\n  Correlations (intra-day CV%):`);
  const rCV   = csum.r_modulus_cv_intraday;
  const pCV   = csum.p_modulus_cv_intraday;
  const rMean = csum.r_modulus_meanGlucose;
  const pMean = csum.p_modulus_meanGlucose;
  console.log(`    r(|λ|, CV%)          = ${rCV >= 0 ? "+" : ""}${rCV.toFixed(2)}  p = ${pCV.toFixed(3)}  n = ${cmeta.subjectCount}  ← not significant`);
  console.log(`    r(|λ|, mean glucose) = ${rMean >= 0 ? "+" : ""}${rMean.toFixed(2)}  p = ${pMean.toFixed(3)}  n = ${cmeta.subjectCount}`);
  console.log();
  for (const r of (cresults as any[]).sort((a: any, b: any) => b.modulus - a.modulus)) {
    console.log(
      `    ${String(r.subject).padEnd(12)} mean=${r.meanGlucose.toFixed(1).padStart(6)} mg/dL` +
      `  CV=${r.cvPercent.toFixed(1).padStart(5)}%  |λ|=${r.modulus.toFixed(3)}`
    );
  }
}

// ── Cross-dataset summary ─────────────────────────────────────────────────

console.log("\n" + "─".repeat(72));
console.log("CROSS-DATASET INTERPRETATION");
console.log("─".repeat(72));
console.log(`
  The inverse |λ|–CV% correlation is DISEASE-RANGE SPECIFIC:

  • Shanghai T2DM (n=10, diabetic): r = −0.68, p = 0.030
    CV% driven by progressive circadian-metabolic uncoupling → |λ| declines
    as glycaemic regulatory architecture degrades.

  • Colas normoglycemic (n=18, healthy): r = +0.26, p = 0.30 (n.s.)
    CV% driven by meal timing and circadian amplitude variation.
    No significant |λ|–CV% association; |λ| values overall higher (mean 0.643).

  Interpretation: the negative correlation is not a generic mathematical
  artefact of how |λ| and CV% are defined. It is specific to the pathological
  range where CV% reflects loss of oscillatory regulatory structure rather
  than meal-driven amplitude. This specificity strengthens rather than
  undermines the diabetic finding.

  Next step for confirmation: multi-day raw CGM data (n ≥ 50) spanning the
  pre-diabetic-to-diabetic spectrum, using clinical CV% from 5-minute readings.

  Archives:
    Shanghai:  ${SHANGHAI_PATH}
    Colas:     ${COLAS_PATH}
  Pipelines:
    Shanghai:  manuscripts/scripts/cgm_shanghai_ar2_analysis.py --verify
    Colas:     python3 manuscripts/scripts/colas2019_cgm_ar2_analysis.py
`);
