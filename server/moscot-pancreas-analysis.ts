import * as fs from 'fs';
import * as path from 'path';

// Moscot-identified pancreatic lineage driver genes (Klein et al., Nature 2025)
// Transcription factors driving delta/epsilon cell fate and endocrinogenesis
const MOSCOT_LINEAGE_TFS = [
  'Neurod2', // Key finding: NEUROD2 validated as epsilon-cell TF; forebrain glutamatergic neurons
  'Neurod1', // Related bHLH TF; endocrine progenitor marker
  'Fev',     // Pet1; serotonergic lineage; epsilon progenitor state
  'Myt1l',   // Neuronal TF; moscot fibroblast/neuronal fate driver
  'Arx',     // Pancreatic alpha-cell TF; also hypothalamic
  'Pax4',    // Beta/delta cell fate determination
  'Insm1',   // Endocrine differentiation TF (IA-1)
  'Neurog3', // Ngn3; master endocrine progenitor TF
];

// Islet effector genes — secreted hormones from differentiated pancreatic cells
const ISLET_EFFECTOR_GENES = [
  'Ins1',  // Insulin (beta cell)
  'Ins2',  // Insulin 2 (beta cell)
  'Gcg',   // Glucagon (alpha cell)
  'Sst',   // Somatostatin (delta cell) — also major hypothalamic peptide
  'Ghrl',  // Ghrelin (epsilon cell)
];

// Clock genes — positive control for high |λ|
const CLOCK_GENES = [
  'Per1', 'Per2', 'Per3',
  'Cry1', 'Cry2',
  'Arntl', // BMAL1
  'Nr1d1', 'Nr1d2', // REV-ERBα/β
  'Dbp', 'Tef', 'Hlf',
  'Rora', 'Rorb', 'Rorc',
  'Clock', 'Npas2',
];

function fitAR2(series: number[]): { phi1: number; phi2: number; eigenvalue: number; r2: number; isComplex: boolean } {
  const n = series.length;
  if (n < 5) return { phi1: 0, phi2: 0, eigenvalue: 0, r2: 0, isComplex: false };
  const m = series.reduce((a, b) => a + b, 0) / n;
  const y = series.map(x => x - m);
  const Y = y.slice(2);
  const Y1 = y.slice(1, n - 1);
  const Y2 = y.slice(0, n - 2);
  let s11 = 0, s22 = 0, s12 = 0, sy1 = 0, sy2 = 0;
  for (let i = 0; i < Y.length; i++) {
    s11 += Y1[i] * Y1[i];
    s22 += Y2[i] * Y2[i];
    s12 += Y1[i] * Y2[i];
    sy1 += Y[i] * Y1[i];
    sy2 += Y[i] * Y2[i];
  }
  const det = s11 * s22 - s12 * s12;
  if (Math.abs(det) < 1e-15) return { phi1: 0, phi2: 0, eigenvalue: 0, r2: 0, isComplex: false };
  const phi1 = (sy1 * s22 - sy2 * s12) / det;
  const phi2 = (sy2 * s11 - sy1 * s12) / det;
  const disc = phi1 * phi1 + 4 * phi2;
  const isComplex = disc < 0;
  let eigenvalue: number;
  if (disc >= 0) {
    eigenvalue = Math.max(
      Math.abs((phi1 + Math.sqrt(disc)) / 2),
      Math.abs((phi1 - Math.sqrt(disc)) / 2)
    );
  } else {
    eigenvalue = Math.sqrt(-phi2);
  }
  const ssRes = Y.reduce((s, yi, i) => s + (yi - phi1 * Y1[i] - phi2 * Y2[i]) ** 2, 0);
  const ssTot = Y.reduce((s, yi) => s + yi * yi, 0);
  const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0;
  return { phi1, phi2, eigenvalue, r2, isComplex };
}

function classifyGene(gene: string): 'clock' | 'moscot_tf' | 'islet_effector' | 'background' {
  if (CLOCK_GENES.includes(gene)) return 'clock';
  if (MOSCOT_LINEAGE_TFS.includes(gene)) return 'moscot_tf';
  if (ISLET_EFFECTOR_GENES.includes(gene)) return 'islet_effector';
  return 'background';
}

function loadCSV(filePath: string): Map<string, number[]> {
  const geneMap = new Map<string, number[]>();
  if (!fs.existsSync(filePath)) return geneMap;
  const lines = fs.readFileSync(filePath, 'utf8').split('\n');
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].trim().split(',');
    if (parts.length < 3) continue;
    const gene = parts[0].trim();
    const values = parts.slice(1).map(Number).filter(v => !isNaN(v));
    if (values.length >= 5) geneMap.set(gene, values);
  }
  return geneMap;
}

function permutationTest(
  focalValues: number[],
  background: number[],
  nPerm = 5000
): { observedMean: number; nullMean: number; nullSd: number; pValue: number; zScore: number } {
  const observedMean = focalValues.reduce((a, b) => a + b, 0) / focalValues.length;
  const n = focalValues.length;
  const allVals = [...focalValues, ...background];
  const nullMeans: number[] = [];
  for (let p = 0; p < nPerm; p++) {
    let sum = 0;
    const used = new Set<number>();
    while (used.size < n) {
      const idx = Math.floor(Math.random() * allVals.length);
      if (!used.has(idx)) { used.add(idx); sum += allVals[idx]; }
    }
    nullMeans.push(sum / n);
  }
  const nullMean = nullMeans.reduce((a, b) => a + b, 0) / nPerm;
  const nullSd = Math.sqrt(nullMeans.reduce((s, v) => s + (v - nullMean) ** 2, 0) / nPerm);
  const pValue = nullMeans.filter(v => v >= observedMean).length / nPerm;
  const zScore = nullSd > 0 ? (observedMean - nullMean) / nullSd : 0;
  return { observedMean, nullMean, nullSd, pValue, zScore };
}

export function runMoscotPancreasAnalysis() {
  const datasetsDir = path.join(process.cwd(), 'datasets');

  // Primary: GSE54650 Hypothalamus — contains SST, Neurod2, Myt1l, Arx, Fev etc.
  const hypoPath = path.join(datasetsDir, 'GSE54650_Hypothalamus_circadian.csv');
  // Secondary: Cerebellum — highest Neurod1/2 expression
  const cerebPath = path.join(datasetsDir, 'GSE54650_Cerebellum_circadian.csv');
  // Liver: metabolic background reference
  const liverPath = path.join(datasetsDir, 'GSE54650_Liver_circadian.csv');

  const hypoData = loadCSV(hypoPath);
  const cerebData = loadCSV(cerebPath);
  const liverData = loadCSV(liverPath);

  // Fit AR(2) to ALL genes in hypothalamus for background distribution
  const allHypoResults: Array<{ gene: string; eigenvalue: number; r2: number }> = [];
  for (const [gene, series] of hypoData.entries()) {
    const fit = fitAR2(series);
    if (fit.r2 > -1) {
      allHypoResults.push({ gene, eigenvalue: fit.eigenvalue, r2: fit.r2 });
    }
  }
  allHypoResults.sort((a, b) => b.eigenvalue - a.eigenvalue);

  // Build per-gene results for focal gene sets (use best tissue per gene)
  type GeneResult = {
    gene: string;
    category: string;
    tissue: string;
    eigenvalue: number;
    phi1: number;
    phi2: number;
    r2: number;
    isComplex: boolean;
    meanExpression: number;
    expressionCV: number;
    moscotRole: string;
    eigenvaluePercentile: number;
  };

  const focalGenes = [...MOSCOT_LINEAGE_TFS, ...ISLET_EFFECTOR_GENES, ...CLOCK_GENES.slice(0, 8)];
  const geneResults: GeneResult[] = [];

  // Compute eigenvalue percentile lookup from background
  const bgEigenvalues = allHypoResults.map(r => r.eigenvalue).sort((a, b) => a - b);
  function computePercentile(ev: number): number {
    const below = bgEigenvalues.filter(v => v < ev).length;
    return Math.round((below / bgEigenvalues.length) * 100);
  }

  for (const gene of focalGenes) {
    // Use cerebellum for Neurod1 (expressed 60× higher there than hypothalamus)
    let tissue = 'Hypothalamus';
    let dataSource = hypoData;
    if (gene === 'Neurod1' && cerebData.has(gene) && hypoData.has(gene)) {
      const cerebMean = cerebData.get(gene)!.reduce((a, b) => a + b, 0) / cerebData.get(gene)!.length;
      const hypoMean = hypoData.get(gene)!.reduce((a, b) => a + b, 0) / hypoData.get(gene)!.length;
      if (cerebMean > hypoMean * 5) { tissue = 'Cerebellum'; dataSource = cerebData; }
    }

    const series = dataSource.get(gene);
    if (!series) continue;

    const fit = fitAR2(series);
    const mean = series.reduce((a, b) => a + b, 0) / series.length;
    const sd = Math.sqrt(series.reduce((s, v) => s + (v - mean) ** 2, 0) / series.length);
    const cv = mean > 0 ? sd / mean : 0;

    geneResults.push({
      gene,
      category: classifyGene(gene),
      tissue,
      eigenvalue: +fit.eigenvalue.toFixed(4),
      phi1: +fit.phi1.toFixed(4),
      phi2: +fit.phi2.toFixed(4),
      r2: +fit.r2.toFixed(4),
      isComplex: fit.isComplex,
      meanExpression: +mean.toFixed(1),
      expressionCV: +cv.toFixed(4),
      moscotRole: MOSCOTOLES[gene] || '',
      eigenvaluePercentile: computePercentile(fit.eigenvalue),
    });
  }

  // Add a few background representative genes for context (high-mid-low)
  const bgSamples = [
    allHypoResults[0],
    allHypoResults[Math.floor(allHypoResults.length * 0.25)],
    allHypoResults[Math.floor(allHypoResults.length * 0.5)],
    allHypoResults[Math.floor(allHypoResults.length * 0.75)],
    allHypoResults[allHypoResults.length - 1],
  ];

  // Permutation tests
  const clockLambdas = geneResults.filter(g => g.category === 'clock').map(g => g.eigenvalue);
  const moscotLambdas = geneResults.filter(g => g.category === 'moscot_tf').map(g => g.eigenvalue);
  const isletLambdas = geneResults.filter(g => g.category === 'islet_effector').map(g => g.eigenvalue);
  const bgLambdas = allHypoResults
    .filter(r => !focalGenes.includes(r.gene))
    .map(r => r.eigenvalue);

  const moscotPermTest = permutationTest(moscotLambdas, bgLambdas, 5000);
  const isletPermTest = permutationTest(isletLambdas, bgLambdas, 5000);

  // Category summary stats
  function summarise(genes: GeneResult[]) {
    if (!genes.length) return { mean: 0, median: 0, n: 0 };
    const sorted = [...genes].sort((a, b) => a.eigenvalue - b.eigenvalue);
    const mean = +( genes.reduce((s, g) => s + g.eigenvalue, 0) / genes.length ).toFixed(4);
    const median = +(sorted[Math.floor(sorted.length / 2)].eigenvalue).toFixed(4);
    return { mean, median, n: genes.length };
  }

  const clockGenes = geneResults.filter(g => g.category === 'clock');
  const moscotGenes = geneResults.filter(g => g.category === 'moscot_tf');
  const isletGenes = geneResults.filter(g => g.category === 'islet_effector');

  const bgMean = +(bgLambdas.reduce((a, b) => a + b, 0) / bgLambdas.length).toFixed(4);
  const bgSorted = [...bgLambdas].sort((a, b) => a - b);
  const bgMedian = +(bgSorted[Math.floor(bgSorted.length / 2)]).toFixed(4);

  // Percentile distribution for chart
  const histBins = Array.from({ length: 20 }, (_, i) => ({
    bin: +(i * 0.05).toFixed(2),
    count: bgLambdas.filter(v => v >= i * 0.05 && v < (i + 1) * 0.05).length,
  }));

  return {
    dataset: {
      name: 'GSE54650 — Hughes Circadian Atlas (Hypothalamus)',
      tissue: 'Hypothalamus (Mus musculus)',
      nTimepoints: 24,
      timepointSpacing: '2h intervals, CT18–CT64',
      totalGenesAnalysed: allHypoResults.length,
      moscotReference: 'Klein et al., Nature 638, 1065–1075 (2025)',
      moscotDoi: '10.1038/s41586-024-08453-2',
    },
    geneResults: geneResults.sort((a, b) => b.eigenvalue - a.eigenvalue),
    categorySummary: {
      clock: { ...summarise(clockGenes), label: 'Clock genes' },
      moscot_tf: { ...summarise(moscotGenes), label: 'Moscot lineage TFs' },
      islet_effector: { ...summarise(isletGenes), label: 'Islet effector genes' },
      background: { mean: bgMean, median: bgMedian, n: bgLambdas.length, label: 'Genome background' },
    },
    permutationTests: {
      moscot_vs_background: {
        ...moscotPermTest,
        nPerm: 5000,
        interpretation: moscotPermTest.pValue < 0.05
          ? 'Moscot lineage TFs show significantly higher temporal persistence than background'
          : 'Moscot lineage TFs do not show elevated persistence vs background',
      },
      islet_vs_background: {
        ...isletPermTest,
        nPerm: 5000,
        interpretation: isletPermTest.pValue < 0.05
          ? 'Islet effector genes show significantly higher temporal persistence than background'
          : 'Islet effector genes do not show elevated persistence vs background',
      },
    },
    backgroundDistribution: {
      bins: histBins,
      mean: bgMean,
      median: bgMedian,
      n: bgLambdas.length,
      topGenes: bgSamples,
    },
    keyFindings: buildKeyFindings(moscotGenes, isletGenes, clockGenes, bgMean, moscotPermTest),
  };
}

const MOSCOTOLES: Record<string, string> = {
  Neurod2: 'Validated epsilon-cell TF (moscot Fig 5)',
  Neurod1: 'Endocrine progenitor bHLH TF',
  Fev: 'Epsilon progenitor state marker (Fev+ cells)',
  Myt1l: 'Neuronal fate driver (moscot spatiotemporal)',
  Arx: 'Alpha-cell / hypothalamic TF',
  Pax4: 'Beta/delta cell fate determinant',
  Insm1: 'Pan-endocrine differentiation TF',
  Neurog3: 'Master endocrine progenitor (Ngn3)',
  Ins1: 'Insulin (beta cell effector)',
  Ins2: 'Insulin-2 (beta cell effector)',
  Gcg: 'Glucagon (alpha cell effector)',
  Sst: 'Somatostatin (delta cell; hypothalamic peptide)',
  Ghrl: 'Ghrelin (epsilon cell effector)',
};

function buildKeyFindings(
  moscotGenes: Array<{ gene: string; eigenvalue: number; eigenvaluePercentile: number }>,
  isletGenes: Array<{ gene: string; eigenvalue: number; eigenvaluePercentile: number }>,
  clockGenes: Array<{ gene: string; eigenvalue: number }>,
  bgMean: number,
  moscotPerm: { pValue: number; observedMean: number; zScore: number }
): string[] {
  const findings: string[] = [];
  const highMoscot = moscotGenes.filter(g => g.eigenvalue > bgMean);
  const lowMoscot = moscotGenes.filter(g => g.eigenvalue <= bgMean);
  findings.push(
    `${highMoscot.length} of ${moscotGenes.length} moscot lineage TFs exceed the genome background mean |λ| of ${bgMean.toFixed(3)} in adult hypothalamus.`
  );
  if (highMoscot.length > 0) {
    const top = highMoscot.sort((a, b) => b.eigenvalue - a.eigenvalue)[0];
    findings.push(
      `Highest-persistence moscot TF: ${top.gene} (|λ| = ${top.eigenvalue.toFixed(3)}, ${top.eigenvaluePercentile}th genome percentile).`
    );
  }
  const sstGene = isletGenes.find(g => g.gene === 'Sst');
  if (sstGene) {
    findings.push(
      `Sst (somatostatin) — delta-cell effector and hypothalamic peptide — shows |λ| = ${sstGene.eigenvalue.toFixed(3)} (${sstGene.eigenvaluePercentile}th percentile), reflecting its dual role as a tissue-specific circadian output.`
    );
  }
  const pancreaticEffectors = isletGenes.filter(g => ['Ins1','Ins2','Gcg','Ghrl'].includes(g.gene));
  const pancLow = pancreaticEffectors.filter(g => g.eigenvalue < bgMean);
  if (pancLow.length > 0) {
    findings.push(
      `Strictly pancreatic hormones (${pancLow.map(g => g.gene).join(', ')}) show low persistence in hypothalamus (mean |λ| = ${(pancLow.reduce((s, g) => s + g.eigenvalue, 0) / pancLow.length).toFixed(3)}), consistent with low/absent expression in this tissue.`
    );
  }
  findings.push(
    moscotPerm.pValue < 0.05
      ? `Permutation test: moscot lineage TFs are collectively enriched for temporal persistence above background (p = ${moscotPerm.pValue.toFixed(3)}, z = ${moscotPerm.zScore.toFixed(2)}).`
      : `Permutation test: moscot lineage TFs show no collective enrichment vs background (p = ${moscotPerm.pValue.toFixed(3)}). Individual genes vary — tissue-specific analysis recommended.`
  );
  return findings;
}
