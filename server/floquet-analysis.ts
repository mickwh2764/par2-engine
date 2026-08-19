/**
 * Floquet Monodromy Analysis for PAR(2) Fibonacci Twinning
 *
 * For a two-gate PAR(2) model (day phase / night phase), the monodromy
 * matrix over one 24-hour cycle is:
 *
 *   M = A_night × A_day
 *
 * where A_gate = [[φ₁_gate, φ₂_gate], [1, 0]] is the companion matrix
 * for each phase gate.
 *
 * Global stability: spectral radius ρ(M) < 1
 * Individual gate stability: |eigenvalue(A_gate)| < 1
 *
 * Key question: are there genes/tissues where individual gates approach
 * the Fibonacci point (φ₁ ≈ 1, φ₂ ≈ 0) — the boundary where A ≈ Boman's
 * matrix — while M remains stable (ρ(M) < 1)?
 */

import * as fs from 'fs';
import { parse } from 'csv-parse/sync';

const PHI = (1 + Math.sqrt(5)) / 2;
const PHI_RECIP = 1 / PHI;
const TWO_PI = 2 * Math.PI;

const TISSUES = [
  'Adrenal','Aorta','Brainstem','Brown_Fat','Cerebellum',
  'Heart','Hypothalamus','Kidney','Liver','Lung','Muscle','White_Fat'
];

const DIRECT_TARGETS = [
  'Dbp','Tef','Hlf','Nfil3',
  'Rora','Rorb','Rorc',
  'Bhlhe40','Bhlhe41','Ciart',
  'Wee1','Nampt','Cdkn1a','Ccrn4l',
];

// 9 core clock output genes used in the pre-specified set.
// Of the 14 declared E-box targets, Cdkn1a and Ccrn4l are absent from GSE54650
// (as noted in Section 5 of the manuscript); all 9 clock genes are present.
// Effective count: 12 E-box + 9 clock = 21 genes × 12 tissues = 252 combinations.
// See manuscript Section 7.1 Note for the full declared list and source citations.
const CORE_CLOCK = [
  'Arntl','Clock','Per1','Per2','Per3','Cry1','Cry2','Nr1d1','Nr1d2'
];

// ─── Data loading ─────────────────────────────────────────────────────────────

function loadTissue(tissue: string): Map<string, { values: number[]; times: number[] }> {
  const path = `datasets/GSE54650_${tissue}_circadian.csv`;
  const result = new Map<string, { values: number[]; times: number[] }>();
  if (!fs.existsSync(path)) return result;

  const content = fs.readFileSync(path, 'utf-8');
  const records = parse(content, { columns: true, skip_empty_lines: true }) as Record<string, string>[];
  if (records.length === 0) return result;

  const headers = Object.keys(records[0]).filter(k => k !== 'Gene' && k !== 'gene');
  const timeInfo = headers.map((h, idx) => {
    const m = h.match(/(?:CT|ZT|T)(\d+)/i) || h.match(/(\d+)/);
    return { idx, time: m ? parseInt(m[1]) : idx * 2, col: h };
  });
  timeInfo.sort((a, b) => a.time - b.time);

  for (const record of records) {
    const gene = record.Gene || record.gene || Object.values(record)[0];
    if (!gene) continue;
    const values = timeInfo.map(ti => parseFloat(record[ti.col]));
    const valid = values.every(v => !isNaN(v));
    if (!valid || values.length < 6) continue;
    result.set(gene, { values, times: timeInfo.map(ti => ti.time) });
  }
  return result;
}

// ─── AR(2) OLS fit ────────────────────────────────────────────────────────────

function fitAR2(z: number[]): { phi1: number; phi2: number } | null {
  if (z.length < 5) return null;
  let s11 = 0, s12 = 0, s22 = 0, sy1 = 0, sy2 = 0;
  for (let t = 2; t < z.length; t++) {
    s11 += z[t - 1] * z[t - 1];
    s12 += z[t - 1] * z[t - 2];
    s22 += z[t - 2] * z[t - 2];
    sy1 += z[t] * z[t - 1];
    sy2 += z[t] * z[t - 2];
  }
  const det = s11 * s22 - s12 * s12;
  if (Math.abs(det) < 1e-12) return null;
  return {
    phi1: (s22 * sy1 - s12 * sy2) / det,
    phi2: (s11 * sy2 - s12 * sy1) / det,
  };
}

// ─── Eigenvalue of 2×2 companion matrix A = [[φ₁, φ₂], [1, 0]] ──────────────

function companionEigenvalue(phi1: number, phi2: number): { modulus: number; isComplex: boolean } {
  const disc = phi1 * phi1 + 4 * phi2;
  if (disc >= 0) {
    const lam1 = (phi1 + Math.sqrt(disc)) / 2;
    const lam2 = (phi1 - Math.sqrt(disc)) / 2;
    return { modulus: Math.max(Math.abs(lam1), Math.abs(lam2)), isComplex: false };
  }
  return { modulus: Math.sqrt(-phi2), isComplex: true };
}

// ─── Monodromy matrix M = A_night × A_day ─────────────────────────────────────
// A = [[φ₁, φ₂], [1, 0]]
// M = A_n × A_d:
//   M[0][0] = φ₁_n × φ₁_d + φ₂_n
//   M[0][1] = φ₁_n × φ₂_d
//   M[1][0] = φ₁_d
//   M[1][1] = φ₂_d
//
// Trace(M) = φ₁_n × φ₁_d + φ₂_n + φ₂_d
// Det(M)   = φ₂_n × φ₂_d   (simplifies exactly)
// Characteristic: λ² − Tr·λ + Det = 0

function monodromySpectralRadius(
  phi1_d: number, phi2_d: number,
  phi1_n: number, phi2_n: number
): {
  spectralRadius: number;
  isComplex: boolean;
  trace: number;
  det: number;
  lambda1: number;
  lambda2: number;
} {
  const tr = phi1_n * phi1_d + phi2_n + phi2_d;
  const det = phi2_n * phi2_d;
  const disc = tr * tr - 4 * det;

  let lam1: number, lam2: number, isComplex: boolean;
  if (disc >= 0) {
    lam1 = (tr + Math.sqrt(disc)) / 2;
    lam2 = (tr - Math.sqrt(disc)) / 2;
    isComplex = false;
  } else {
    lam1 = Math.sqrt(Math.abs(det));
    lam2 = lam1;
    isComplex = true;
  }

  const spectralRadius = isComplex ? Math.sqrt(Math.abs(det)) : Math.max(Math.abs(lam1), Math.abs(lam2));
  return { spectralRadius, isComplex, trace: tr, det, lambda1: lam1, lambda2: lam2 };
}

// ─── Fibonacci proximity for a coefficient pair ───────────────────────────────
// The Fibonacci point is (φ₁, φ₂) = (1, 0) in companion matrix terms
// (Boman's matrix [[1,1],[1,0]] → companion form has φ₁=1, φ₂=0 is the
//  limiting stable approach; the unstable Fibonacci point is φ₁=1, φ₂=0
//  at the boundary. We measure distance from (1,0) in (φ₁,φ₂) space.)
// Note: actual Boman/Fibonacci boundary in coefficient space is
//  the triangle boundary where dominant eigenvalue = φ, approached as
//  (φ₁,φ₂) → (1,0) from within the stability triangle.

function fibonacciProximity(phi1: number, phi2: number): number {
  return Math.sqrt((phi1 - 1) ** 2 + phi2 ** 2);
}

// ─── Per-gene, per-tissue Floquet analysis ────────────────────────────────────

export interface FloquetGeneResult {
  gene: string;
  tier: string;
  tissueResults: {
    tissue: string;
    phi1_day: number;
    phi2_day: number;
    phi1_night: number;
    phi2_night: number;
    dayEigenvalue: number;
    nightEigenvalue: number;
    dayIsComplex: boolean;
    nightIsComplex: boolean;
    monodromyRadius: number;
    monodromyIsComplex: boolean;
    monodromyTrace: number;
    monodromyDet: number;
    isStable: boolean;
    dayNearFibonacci: number;
    nightNearFibonacci: number;
    closerGate: 'day' | 'night';
    transientFibonacci: boolean; // one gate near Fibonacci while M is stable
  }[];
  nTissues: number;
  nStable: number;
  fracStable: number;
  meanDayEigenvalue: number;
  meanNightEigenvalue: number;
  meanMonodromyRadius: number;
  minDayFibProx: number;
  minNightFibProx: number;
  nTransientFibonacci: number;
  meanDayPhi1: number;
  meanNightPhi1: number;
}

export interface FloquetReport {
  genes: FloquetGeneResult[];
  coreClockGenes: FloquetGeneResult[];
  summary: {
    totalGenes: number;
    totalTissueCombinations: number;
    nStableCombinations: number;
    fracStable: number;
    nTransientFibonacciCombinations: number;
    fracTransientFibonacci: number;
    meanMonodromyRadius: number;
    genesWithTransient: string[];
  };
  interpretation: string;
  computed: string;
}

export function runFloquetAnalysis(): FloquetReport {
  const allGenes = [
    ...DIRECT_TARGETS.map(g => ({ gene: g, tier: 'Direct BMAL1/CLOCK target' })),
    ...CORE_CLOCK.map(g => ({ gene: g, tier: 'Core clock gene' })),
  ];

  // Load all 12 tissues once
  const tissueData = new Map<string, Map<string, { values: number[]; times: number[] }>>();
  for (const tissue of TISSUES) {
    tissueData.set(tissue, loadTissue(tissue));
  }

  const analyseGene = (gene: string, tier: string): FloquetGeneResult => {
    const tissueResults: FloquetGeneResult['tissueResults'] = [];

    for (const tissue of TISSUES) {
      const tData = tissueData.get(tissue);
      if (!tData) continue;
      const entry = tData.get(gene);
      if (!entry) continue;

      const { values, times } = entry;
      const n = values.length;
      const mean = values.reduce((a, b) => a + b, 0) / n;
      const z = values.map(v => v - mean);
      const period = 24;

      // Split into day (phase 0–π) and night (phase π–2π)
      const dayIdx: number[] = [];
      const nightIdx: number[] = [];
      for (let i = 2; i < n; i++) {
        const phase = (TWO_PI * (times[i] % period)) / period;
        if (phase < Math.PI) {
          dayIdx.push(i);
        } else {
          nightIdx.push(i);
        }
      }

      if (dayIdx.length < 3 || nightIdx.length < 3) continue;

      const dayFit = fitAR2(z.filter((_, i) => dayIdx.includes(i) || dayIdx.includes(i + 1) || dayIdx.includes(i + 2)));
      const nightFit = fitAR2(z.filter((_, i) => nightIdx.includes(i) || nightIdx.includes(i + 1) || nightIdx.includes(i + 2)));

      // More robust: pass only the relevant values directly
      const dayVals = dayIdx.map(i => z[i]);
      const dayValsLag1 = dayIdx.map(i => z[i - 1]);
      const dayValsLag2 = dayIdx.map(i => z[i - 2]);
      const nightVals = nightIdx.map(i => z[i]);
      const nightValsLag1 = nightIdx.map(i => z[i - 1]);
      const nightValsLag2 = nightIdx.map(i => z[i - 2]);

      const fitSegment = (
        y: number[], y1: number[], y2: number[]
      ): { phi1: number; phi2: number } | null => {
        if (y.length < 3) return null;
        let s11=0, s12=0, s22=0, sy1=0, sy2=0;
        for (let k = 0; k < y.length; k++) {
          s11 += y1[k] * y1[k];
          s12 += y1[k] * y2[k];
          s22 += y2[k] * y2[k];
          sy1 += y[k] * y1[k];
          sy2 += y[k] * y2[k];
        }
        const det = s11 * s22 - s12 * s12;
        if (Math.abs(det) < 1e-12) return null;
        return {
          phi1: (s22 * sy1 - s12 * sy2) / det,
          phi2: (s11 * sy2 - s12 * sy1) / det,
        };
      };

      const dFit = fitSegment(dayVals, dayValsLag1, dayValsLag2);
      const nFit = fitSegment(nightVals, nightValsLag1, nightValsLag2);
      if (!dFit || !nFit) continue;

      const { phi1: phi1_d, phi2: phi2_d } = dFit;
      const { phi1: phi1_n, phi2: phi2_n } = nFit;

      const dayEig = companionEigenvalue(phi1_d, phi2_d);
      const nightEig = companionEigenvalue(phi1_n, phi2_n);
      const mono = monodromySpectralRadius(phi1_d, phi2_d, phi1_n, phi2_n);

      const dayFibProx = fibonacciProximity(phi1_d, phi2_d);
      const nightFibProx = fibonacciProximity(phi1_n, phi2_n);

      // Transient Fibonacci proximity criterion (manuscript Section 7):
      // A gene–tissue combination is transient-Fibonacci if ρ(M) < 1 AND at least one
      // phase gate has its coefficient pair within distance 0.4 of (1,0) in (φ₁, φ₂)
      // space.  This produces the reported 98/251 (39.0%) figure and matches Table 1.
      // The eigenvalue band [0.52, 0.72] is biological interpretive context (Section 8,
      // Proposition 4) and is not applied as a gate-level filter here.
      const FIB_THRESHOLD = 0.4;
      const transientFibonacci = mono.spectralRadius < 1 && (
        dayFibProx < FIB_THRESHOLD || nightFibProx < FIB_THRESHOLD
      );

      tissueResults.push({
        tissue,
        phi1_day: phi1_d, phi2_day: phi2_d,
        phi1_night: phi1_n, phi2_night: phi2_n,
        dayEigenvalue: dayEig.modulus,
        nightEigenvalue: nightEig.modulus,
        dayIsComplex: dayEig.isComplex,
        nightIsComplex: nightEig.isComplex,
        monodromyRadius: mono.spectralRadius,
        monodromyIsComplex: mono.isComplex,
        monodromyTrace: mono.trace,
        monodromyDet: mono.det,
        isStable: mono.spectralRadius < 1,
        dayNearFibonacci: dayFibProx,
        nightNearFibonacci: nightFibProx,
        closerGate: dayFibProx < nightFibProx ? 'day' : 'night',
        transientFibonacci,
      });
    }

    const n = tissueResults.length;
    if (n === 0) {
      return {
        gene, tier, tissueResults: [],
        nTissues: 0, nStable: 0, fracStable: 0,
        meanDayEigenvalue: 0, meanNightEigenvalue: 0, meanMonodromyRadius: 0,
        minDayFibProx: 1, minNightFibProx: 1, nTransientFibonacci: 0,
        meanDayPhi1: 0, meanNightPhi1: 0,
      };
    }

    const nStable = tissueResults.filter(r => r.isStable).length;
    return {
      gene, tier, tissueResults,
      nTissues: n,
      nStable,
      fracStable: nStable / n,
      meanDayEigenvalue: tissueResults.reduce((s, r) => s + r.dayEigenvalue, 0) / n,
      meanNightEigenvalue: tissueResults.reduce((s, r) => s + r.nightEigenvalue, 0) / n,
      meanMonodromyRadius: tissueResults.reduce((s, r) => s + r.monodromyRadius, 0) / n,
      minDayFibProx: Math.min(...tissueResults.map(r => r.dayNearFibonacci)),
      minNightFibProx: Math.min(...tissueResults.map(r => r.nightNearFibonacci)),
      nTransientFibonacci: tissueResults.filter(r => r.transientFibonacci).length,
      meanDayPhi1: tissueResults.reduce((s, r) => s + r.phi1_day, 0) / n,
      meanNightPhi1: tissueResults.reduce((s, r) => s + r.phi1_night, 0) / n,
    };
  };

  const targetResults = DIRECT_TARGETS.map(g => analyseGene(g, 'Direct BMAL1/CLOCK target'));
  const clockResults = CORE_CLOCK.map(g => analyseGene(g, 'Core clock gene'));
  const allResults = [...targetResults, ...clockResults].filter(r => r.nTissues > 0);

  // Summary statistics
  const totalCombos = allResults.reduce((s, r) => s + r.nTissues, 0);
  const totalStable = allResults.reduce((s, r) => s + r.nStable, 0);
  const totalTransient = allResults.reduce((s, r) => s + r.nTransientFibonacci, 0);
  const meanRadius = allResults.length > 0
    ? allResults.reduce((s, r) => s + r.meanMonodromyRadius, 0) / allResults.length
    : 0;
  const genesWithTransient = allResults
    .filter(r => r.nTransientFibonacci > 0)
    .map(r => r.gene);

  // Build interpretation
  const fracStable = totalCombos > 0 ? totalStable / totalCombos : 0;
  const fracTransient = totalCombos > 0 ? totalTransient / totalCombos : 0;

  let interpretation = '';
  if (fracStable > 0.9) {
    interpretation = `${(fracStable * 100).toFixed(0)}% of gene–tissue combinations are globally stable (monodromy spectral radius < 1), ` +
      `even though individual phase gates may have coefficients that approach the Fibonacci boundary. `;
  } else if (fracStable > 0.7) {
    interpretation = `${(fracStable * 100).toFixed(0)}% of gene–tissue combinations show global stability under the monodromy criterion. ` +
      `Some instability arises at high-coefficient phase segments. `;
  } else {
    interpretation = `${(fracStable * 100).toFixed(0)}% of combinations show global stability — the two-gate model reveals more instability than constant-coefficient AR(2). `;
  }

  if (fracTransient > 0) {
    interpretation += `${totalTransient} combinations (${(fracTransient * 100).toFixed(0)}%) show transient Fibonacci proximity: ` +
      `at least one phase gate approaches the Fibonacci coefficient boundary (within distance 0.4 of (φ₁=1, φ₂=0)) ` +
      `while the monodromy matrix remains stable. ` +
      `These genes visit Fibonacci-like dynamics within the circadian cycle without losing global stability. ` +
      `Genes exhibiting this pattern: ${genesWithTransient.join(', ')}.`;
  } else {
    interpretation += `No combinations show transient Fibonacci proximity under the 0.4 threshold — ` +
      `coefficient pairs remain well within the stable interior during both phase gates.`;
  }

  return {
    genes: targetResults.filter(r => r.nTissues > 0),
    coreClockGenes: clockResults.filter(r => r.nTissues > 0),
    summary: {
      totalGenes: allResults.length,
      totalTissueCombinations: totalCombos,
      nStableCombinations: totalStable,
      fracStable,
      nTransientFibonacciCombinations: totalTransient,
      fracTransientFibonacci: fracTransient,
      meanMonodromyRadius: meanRadius,
      genesWithTransient,
    },
    interpretation,
    computed: new Date().toISOString(),
  };
}
