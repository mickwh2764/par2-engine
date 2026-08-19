/**
 * PAR(2) Browser Engine
 *
 * Pure-browser AR(2) eigenvalue pipeline.
 * Processes user-uploaded CSVs entirely in-browser — no server round-trip.
 * Output shape matches /api/analyze/wearable (gene_expression_matrix format)
 * so the Discovery Engine UI needs zero changes.
 */

import Papa from "papaparse";

// ─── Clock gene lists ─────────────────────────────────────────────────────────
const CLOCK_GENES = new Set([
  "arntl","arntl2","bmal1","bmal2","clock","cry1","cry2","npas2","nr1d1","nr1d2",
  "per1","per2","per3","rora","rorb","rorc","dbp","hlf","tef","nfil3","e4bp4",
  "timeless","tipin","csnk1d","csnk1e","fbxl3","fbxl21","sirt1","hdac3",
  // Ensembl mouse IDs
  "ensmusg00000055116","ensmusg00000029238","ensmusg00000020893",
  "ensmusg00000055866","ensmusg00000028957","ensmusg00000020038",
  "ensmusg00000068742","ensmusg00000020889","ensmusg00000021775",
  "ensmusg00000062357","ensmusg00000059821","ensmusg00000026780",
]);

function isClockGene(name: string) { return CLOCK_GENES.has(name.toLowerCase()); }

// ─── Seeded RNG (Mulberry32) ──────────────────────────────────────────────────
function mulberry32(seed: number) {
  return () => {
    let s = (seed = seed + 0x6D2B79F5 | 0);
    let t = Math.imul(s ^ s >>> 15, 1 | s);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─── OLS AR(2) fitting ────────────────────────────────────────────────────────
interface FitResult {
  phi1: number; phi2: number; eigenvalue: number; r2: number;
  residuals: number[]; isComplex: boolean;
  lambda1Real: number; lambda1Imag: number;
  lambda2Real: number; lambda2Imag: number;
  impliedPeriod: number | null; halfLife: number | null;
}

function fitAR2(series: number[]): FitResult | null {
  const n = series.length;
  if (n < 6) return null;

  let sx1x1 = 0, sx1x2 = 0, sx2x2 = 0, sx1y = 0, sx2y = 0;
  let sumY = 0;

  for (let t = 2; t < n; t++) {
    const x1 = series[t - 1], x2 = series[t - 2], y = series[t];
    sx1x1 += x1 * x1; sx1x2 += x1 * x2; sx2x2 += x2 * x2;
    sx1y  += x1 * y;  sx2y  += x2 * y;  sumY  += y;
  }

  const det = sx1x1 * sx2x2 - sx1x2 * sx1x2;
  if (Math.abs(det) < 1e-12) return null;

  const phi1 = (sx1y * sx2x2 - sx1x2 * sx2y) / det;
  const phi2 = (sx1x1 * sx2y - sx1x2 * sx1y) / det;

  const m = n - 2;
  const yMean = sumY / m;
  let ssRes = 0, ssTot = 0;
  const residuals: number[] = [];
  for (let t = 2; t < n; t++) {
    const yHat = phi1 * series[t - 1] + phi2 * series[t - 2];
    const e = series[t] - yHat;
    residuals.push(e);
    ssRes += e * e;
    ssTot += (series[t] - yMean) ** 2;
  }
  const r2 = ssTot > 1e-12 ? Math.max(0, 1 - ssRes / ssTot) : 0;

  // Eigenvalues
  const disc = phi1 * phi1 + 4 * phi2;
  let lambda1Real: number, lambda1Imag: number, lambda2Real: number, lambda2Imag: number;
  let isComplex: boolean, eigenvalue: number, impliedPeriod: number | null = null;

  if (disc >= 0) {
    const sqrtD = Math.sqrt(disc);
    lambda1Real = (phi1 + sqrtD) / 2; lambda1Imag = 0;
    lambda2Real = (phi1 - sqrtD) / 2; lambda2Imag = 0;
    isComplex = false;
    eigenvalue = Math.max(Math.abs(lambda1Real), Math.abs(lambda2Real));
  } else {
    lambda1Real = phi1 / 2; lambda1Imag = Math.sqrt(-disc) / 2;
    lambda2Real = phi1 / 2; lambda2Imag = -Math.sqrt(-disc) / 2;
    isComplex = true;
    eigenvalue = Math.sqrt(lambda1Real ** 2 + lambda1Imag ** 2);
    const arg = Math.atan2(lambda1Imag, lambda1Real);
    if (Math.abs(arg) > 1e-10) {
      const periodsInSamples = (2 * Math.PI) / Math.abs(arg);
      impliedPeriod = periodsInSamples; // in sample units — caller can multiply by hours
    }
  }

  const halfLife = eigenvalue > 0 && eigenvalue < 1
    ? Math.log(0.5) / Math.log(eigenvalue) : null;

  return { phi1, phi2, eigenvalue, r2, residuals, isComplex,
    lambda1Real, lambda1Imag, lambda2Real, lambda2Imag, impliedPeriod, halfLife };
}

// ─── ACF of residuals ─────────────────────────────────────────────────────────
function computeACF(residuals: number[], maxLag = 8): number[] {
  const n = residuals.length;
  if (n < 4) return [];
  const mean = residuals.reduce((a, b) => a + b, 0) / n;
  const variance = residuals.reduce((a, b) => a + (b - mean) ** 2, 0) / n;
  if (variance < 1e-12) return new Array(Math.min(maxLag, n - 1)).fill(0);
  const acf: number[] = [];
  for (let lag = 1; lag <= Math.min(maxLag, n - 1); lag++) {
    let cov = 0;
    for (let i = lag; i < n; i++) cov += (residuals[i] - mean) * (residuals[i - lag] - mean);
    acf.push(cov / (n * variance));
  }
  return acf;
}

// ─── Ljung-Box test (chi-squared approximation) ───────────────────────────────
function ljungBox(residuals: number[], h = 6): { passed: boolean; pValue: number } {
  const n = residuals.length;
  const acf = computeACF(residuals, h);
  let Q = 0;
  for (let k = 1; k <= acf.length; k++) {
    Q += (acf[k - 1] ** 2) / (n - k);
  }
  Q *= n * (n + 2);

  // Chi-squared CDF approximation (Wilson-Hilferty)
  const df = acf.length;
  const x = Q;
  const p = df > 0 ? 1 - chi2CDF(x, df) : 1;
  return { passed: p > 0.05, pValue: Math.max(0, Math.min(1, p)) };
}

function chi2CDF(x: number, df: number): number {
  if (x <= 0) return 0;
  // Approximation via regularised incomplete gamma (Wilson-Hilferty)
  const h = df / 2;
  return regularisedGammaP(h, x / 2);
}

function regularisedGammaP(a: number, x: number): number {
  if (x < 0) return 0;
  if (x === 0) return 0;
  if (a <= 0) return 1;
  // Series expansion for small x
  if (x < a + 1) {
    let sum = 1 / a, term = 1 / a;
    for (let i = 1; i < 200; i++) {
      term *= x / (a + i);
      sum += term;
      if (Math.abs(term) < 1e-10 * Math.abs(sum)) break;
    }
    return Math.min(1, sum * Math.exp(-x + a * Math.log(x) - lnGamma(a)));
  }
  // Continued fraction for large x
  let b = x + 1 - a, c = 1 / 1e-30, d = 1 / b, h2 = d;
  for (let i = 1; i <= 200; i++) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b; if (Math.abs(d) < 1e-30) d = 1e-30;
    c = b + an / c;   if (Math.abs(c) < 1e-30) c = 1e-30;
    d = 1 / d;
    const del = d * c;
    h2 *= del;
    if (Math.abs(del - 1) < 1e-10) break;
  }
  return Math.max(0, 1 - Math.min(1, Math.exp(-x + a * Math.log(x) - lnGamma(a)) * h2));
}

function lnGamma(z: number): number {
  // Lanczos approximation
  const g = 7;
  const c = [0.99999999999980993,676.5203681218851,-1259.1392167224028,
    771.32342877765313,-176.61502916214059,12.507343278686905,
    -0.13857109526572012,9.9843695780195716e-6,1.5056327351493116e-7];
  if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - lnGamma(1 - z);
  z -= 1;
  let x = c[0];
  for (let i = 1; i < g + 2; i++) x += c[i] / (z + i);
  const t = z + g + 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}

// ─── Stability label ──────────────────────────────────────────────────────────
function stabilityLabel(ev: number): { stability: string; stabilityColor: string } {
  if (ev < 0.5)  return { stability: 'Highly Stable',        stabilityColor: '#22c55e' };
  if (ev < 0.7)  return { stability: 'Stable Rhythm',        stabilityColor: '#4ade80' };
  if (ev < 0.85) return { stability: 'Moderate Persistence', stabilityColor: '#facc15' };
  if (ev < 0.95) return { stability: 'High Persistence',     stabilityColor: '#f97316' };
  if (ev < 1.0)  return { stability: 'Near-Critical',        stabilityColor: '#ef4444' };
  return             { stability: 'Unstable / Divergent', stabilityColor: '#dc2626' };
}

// ─── Confidence scoring ───────────────────────────────────────────────────────
function confidence(r2: number, n: number, lbPassed: boolean): { label: string; score: number } {
  let score = 0;
  score += Math.min(40, r2 * 40);
  score += Math.min(30, (n / 48) * 30);
  if (lbPassed) score += 20;
  if (n >= 24) score += 10;
  score = Math.round(Math.min(100, Math.max(0, score)));
  const label = score >= 70 ? 'High' : score >= 50 ? 'Moderate' : score >= 30 ? 'Low' : 'Unreliable';
  return { label, score };
}

// ─── CSV parsing ──────────────────────────────────────────────────────────────
function parseMatrix(text: string): { geneIds: string[]; data: Map<string, number[]>; nTimepoints: number } | null {
  const sep = (text.split("\n")[0] || "").includes("\t") ? "\t" : ",";
  const parsed = Papa.parse<string[]>(text.trim(), { delimiter: sep, skipEmptyLines: true });
  if (!parsed.data || parsed.data.length < 3) return null;

  const header = parsed.data[0];
  const nCols = header.length;
  const numericCols = (parsed.data[1] || []).slice(1).filter(v => !isNaN(parseFloat(v))).length;
  if (numericCols < 3 || parsed.data.length < 3) return null;

  const geneIds: string[] = [];
  const data = new Map<string, number[]>();

  for (let r = 1; r < parsed.data.length; r++) {
    const row = parsed.data[r];
    if (!row || row.length < 2) continue;
    const geneId = (row[0] || "").trim();
    if (!geneId) continue;
    const values = row.slice(1, nCols).map(v => parseFloat(v));
    if (values.filter(v => !isNaN(v)).length < 3) continue;
    if (!data.has(geneId)) { geneIds.push(geneId); data.set(geneId, values); }
  }

  return { geneIds, data, nTimepoints: nCols - 1 };
}

// ─── Main export ──────────────────────────────────────────────────────────────
export async function analyzeCSVInBrowser(file: File): Promise<Record<string, unknown>> {
  const t0 = performance.now();
  const text = await file.text();

  // Binary check
  if ((text.slice(0, 2000).match(/[\x00-\x08\x0E-\x1F]/g) || []).length >
      text.slice(0, 2000).length * 0.05) {
    throw new Error("This file appears to be binary. Please upload a CSV or TSV file.");
  }

  const parsed = parseMatrix(text);
  if (!parsed || parsed.geneIds.length === 0) {
    throw new Error(
      "Could not detect a gene expression matrix. " +
      "Expected: rows = genes, columns = time points, first column = gene names."
    );
  }

  const warnings: { type: string; message: string; severity: string; genes?: string[] }[] = [];
  const skipped: string[] = [];

  // Constant / corrupted checks
  const constantGenes: string[] = [], corruptedGenes: string[] = [], outlierGenes: string[] = [];
  for (const geneId of parsed.geneIds) {
    const vals = parsed.data.get(geneId)!;
    const valid = vals.filter(v => !isNaN(v) && isFinite(v));
    if (valid.length < vals.length * 0.5) { corruptedGenes.push(geneId); continue; }
    const m = valid.reduce((a, b) => a + b, 0) / valid.length;
    const variance = valid.reduce((a, b) => a + (b - m) ** 2, 0) / valid.length;
    if (variance < 1e-10) constantGenes.push(geneId);
    const sd = Math.sqrt(variance) || 1;
    if (valid.some(v => Math.abs(v - m) > 10 * sd)) outlierGenes.push(geneId);
  }
  if (constantGenes.length) warnings.push({ type: 'constant_genes', severity: 'warning',
    message: `${constantGenes.length} gene(s) have zero variance and are excluded: ${constantGenes.slice(0, 10).join(', ')}`, genes: constantGenes });
  if (corruptedGenes.length) warnings.push({ type: 'corrupted_rows', severity: 'warning',
    message: `${corruptedGenes.length} gene(s) have >50% missing values and are excluded: ${corruptedGenes.slice(0, 10).join(', ')}`, genes: corruptedGenes });
  if (outlierGenes.length) warnings.push({ type: 'outlier_genes', severity: 'info',
    message: `${outlierGenes.length} gene(s) have extreme outlier values (>10 SD). Results may be less reliable for: ${outlierGenes.slice(0, 10).join(', ')}`, genes: outlierGenes });

  const excluded = new Set([...constantGenes, ...corruptedGenes]);

  // ── Per-gene AR(2) ──
  interface GeneResult {
    gene: string; phi1: number; phi2: number; eigenvalue: number; r2: number;
    isComplex: boolean; lambda1Real: number; lambda1Imag: number;
    lambda2Real: number; lambda2Imag: number; halfLife: number | null;
    impliedPeriod: number | null; sampleCount: number; mean: number; std: number;
    stability: string; stabilityColor: string; overallConfidence: string;
    confidenceScore: number; expression: number[]; residuals: number[];
    acf: number[]; ljungBoxPassed: boolean; ljungBoxPValue: number;
    qualityChecks: unknown[]; edgeCaseDiagnostics: unknown[]; geneType: string;
  }

  const perGeneResults: GeneResult[] = [];

  for (const geneId of parsed.geneIds) {
    if (excluded.has(geneId)) { skipped.push(geneId); continue; }
    const rawVals = parsed.data.get(geneId)!;
    const series = rawVals.map(v => (isNaN(v) || !isFinite(v)) ? 0 : v);
    if (series.filter(v => v !== 0).length < 6) { skipped.push(geneId); continue; }

    const n = series.length;
    const mean = series.reduce((a, b) => a + b, 0) / n;
    const variance = series.reduce((a, b) => a + (b - mean) ** 2, 0) / n;
    if (!isFinite(mean) || variance < 1e-10) { skipped.push(geneId); continue; }
    const std = Math.sqrt(variance);

    const fit = fitAR2(series);
    if (!fit || !isFinite(fit.eigenvalue)) { skipped.push(geneId); continue; }

    const lb = ljungBox(fit.residuals);
    const acf = computeACF(fit.residuals);
    const { stability, stabilityColor } = stabilityLabel(fit.eigenvalue);
    const conf = confidence(fit.r2, n, lb.passed);

    const qualityChecks = [
      { name: 'Minimum timepoints', passed: n >= 12,
        detail: `${n} timepoints (minimum 12 for reliable AR(2))` },
      { name: 'R² > 0.3', passed: fit.r2 >= 0.3, detail: `R² = ${fit.r2.toFixed(3)}` },
      { name: 'Ljung-Box residual independence', passed: lb.passed,
        detail: `p = ${lb.pValue.toFixed(3)} (p > 0.05 = no autocorrelation in residuals)` },
      { name: 'Stationarity (|λ| < 1)', passed: fit.eigenvalue < 1,
        detail: `|λ| = ${fit.eigenvalue.toFixed(4)}` },
    ];

    perGeneResults.push({
      gene: geneId, ...fit, sampleCount: n, mean, std,
      stability, stabilityColor, overallConfidence: conf.label,
      confidenceScore: conf.score, expression: series, acf,
      ljungBoxPassed: lb.passed, ljungBoxPValue: lb.pValue,
      qualityChecks, edgeCaseDiagnostics: [],
      geneType: isClockGene(geneId) ? 'clock' : 'target',
    });
  }

  perGeneResults.sort((a, b) => b.eigenvalue - a.eigenvalue);

  // ── Gearbox / hierarchy ──
  const clockResults = perGeneResults.filter(g => g.geneType === 'clock');
  const targetResults = perGeneResults.filter(g => g.geneType === 'target');
  const avg = (arr: GeneResult[]) =>
    arr.length ? arr.reduce((s, g) => s + g.eigenvalue, 0) / arr.length : null;
  const clockMean = avg(clockResults);
  const targetMean = avg(targetResults);
  const gap = clockMean !== null && targetMean !== null ? clockMean - targetMean : null;
  const hierarchyStatus =
    gap === null ? 'insufficient-data' :
    gap > 0.05  ? 'hierarchy-present' :
    gap < -0.05 ? 'hierarchy-inverted' : 'no-hierarchy';

  // ── Build results (top 50, matching server shape) ──
  const topGenes = perGeneResults.slice(0, 50);
  const results = topGenes.map(g => ({
    channel: g.gene, unit: g.geneType === 'clock' ? 'clock gene' : 'gene',
    sampleCount: g.sampleCount, phi1: g.phi1, phi2: g.phi2,
    eigenvalue: g.eigenvalue, r2: g.r2, isComplex: g.isComplex,
    lambda1Real: g.lambda1Real, lambda1Imag: g.lambda1Imag,
    lambda2Real: g.lambda2Real, lambda2Imag: g.lambda2Imag,
    halfLife: g.halfLife, impliedPeriod: g.impliedPeriod,
    mean: g.mean, std: g.std,
    min: Math.min(...g.expression), max: Math.max(...g.expression),
    stability: g.stability, stabilityColor: g.stabilityColor,
    ljungBoxPassed: g.ljungBoxPassed, ljungBoxPValue: g.ljungBoxPValue,
    timeSeriesPreview: g.expression, residuals: g.residuals, acf: g.acf,
    qualityChecks: g.qualityChecks, overallConfidence: g.overallConfidence,
    confidenceColor: g.confidenceScore >= 70 ? '#22c55e' : g.confidenceScore >= 50 ? '#facc15' : '#f97316',
    confidenceScore: g.confidenceScore, edgeCaseDiagnostics: g.edgeCaseDiagnostics,
  }));

  // ── Bias audit (time-shuffle test, 200 permutations) ──
  let biasAudit: unknown = null;
  if (perGeneResults.length >= 10) {
    const rng = mulberry32(42);
    const sample = perGeneResults.slice(0, Math.min(100, perGeneResults.length));
    const origEV = sample.map(g => g.eigenvalue);
    const shuffEV = sample.map(g => {
      const shuffled = shuffle(g.expression, rng);
      const f = fitAR2(shuffled);
      return f ? f.eigenvalue : 0;
    });
    const origMean = origEV.reduce((a, b) => a + b, 0) / origEV.length;
    const shuffMean = shuffEV.reduce((a, b) => a + b, 0) / shuffEV.length;
    const reduction = origMean > 0 ? ((origMean - shuffMean) / origMean) * 100 : 0;
    biasAudit = {
      test1_timeShuffleDestroysHierarchy: {
        passed: reduction > 20,
        originalMeanEigenvalue: origMean,
        shuffledMeanEigenvalue: shuffMean,
        reductionPercent: reduction,
        interpretation: reduction > 20
          ? `Time-shuffle reduces mean |λ| by ${reduction.toFixed(1)}%, confirming temporal structure is not random noise.`
          : `Time-shuffle only reduces mean |λ| by ${reduction.toFixed(1)}%. Consider interpreting results cautiously.`,
      },
    };
  }

  return {
    fileName: file.name,
    detectedFormat: 'gene_expression_matrix',
    totalRecords: parsed.nTimepoints,
    processingTimeMs: Math.round(performance.now() - t0),
    processedInBrowser: true,   // flag so UI can show "processed locally"
    results,
    channels: results,          // backward-compat alias
    skippedChannels: skipped,
    dataWarnings: warnings,
    gearboxAnalysis: {
      clockEigenvalue: clockMean,
      targetEigenvalue: targetMean,
      gap,
      hierarchyStatus,
      clockGenes: clockResults.map(g => g.gene),
      targetGenes: targetResults.map(g => g.gene),
    },
    perGeneAnalysis: {
      totalGenes: perGeneResults.length,
      clockGenes: clockResults.length,
      targetGenes: targetResults.length,
      clockMean, targetMean, gap,
      topByEigenvalue: perGeneResults.slice(0, 20).map(g => ({
        gene: g.gene, geneType: g.geneType, eigenvalue: g.eigenvalue,
        stability: g.stability, r2: g.r2,
      })),
      bottomByEigenvalue: perGeneResults.slice(-10).reverse().map(g => ({
        gene: g.gene, geneType: g.geneType, eigenvalue: g.eigenvalue,
        stability: g.stability, r2: g.r2,
      })),
    },
    biasAudit,
    metadata: {
      eigenvalueEquation: "λ² − φ₁λ − φ₂ = 0",
      method: "AR(2) via OLS — processed in browser",
      samplingNote: "Implied period in sample units; multiply by your sampling interval (hours) for biological period.",
    },
    safeguards: { minimumTimepoints: 6 },
  };
}
