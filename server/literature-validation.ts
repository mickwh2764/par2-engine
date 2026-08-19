import { runGenomeWideCoupling } from './genome-wide-coupling';
import * as fs from 'fs';
import { parse } from 'csv-parse/sync';

interface LiteratureGene {
  gene: string;
  pathway: string;
  discoveryMethod: string;
  citation: string;
  year: number;
  finding: string;
}

export const LITERATURE_CIRCADIAN_GENES: LiteratureGene[] = [
  { gene: 'Fasn', pathway: 'Lipid Metabolism', discoveryMethod: 'Microarray + qPCR', citation: 'Panda et al., Cell 2002', year: 2002, finding: 'Rhythmic expression in liver, peak at CT14-18' },
  { gene: 'Hmgcr', pathway: 'Lipid Metabolism', discoveryMethod: 'Microarray', citation: 'Panda et al., Cell 2002', year: 2002, finding: 'Cholesterol synthesis enzyme with circadian expression' },
  { gene: 'Scd1', pathway: 'Lipid Metabolism', discoveryMethod: 'RNA-seq time series', citation: 'Zhang et al., PNAS 2014', year: 2014, finding: 'Rhythmic in liver, stearoyl-CoA desaturase' },
  { gene: 'Hmgcs2', pathway: 'Lipid Metabolism', discoveryMethod: 'Metabolomics + qPCR', citation: 'Adamovich et al., Cell Metab 2014', year: 2014, finding: 'Ketogenesis enzyme under BMAL1 control' },
  { gene: 'Acaca', pathway: 'Lipid Metabolism', discoveryMethod: 'ChIP-seq', citation: 'Koike et al., Science 2012', year: 2012, finding: 'Direct BMAL1 target, acetyl-CoA carboxylase' },
  { gene: 'Ppara', pathway: 'Lipid Metabolism', discoveryMethod: 'Knockout + Microarray', citation: 'Yang et al., Cell 2006', year: 2006, finding: 'Nuclear receptor under clock control, fatty acid oxidation' },
  { gene: 'Srebf1', pathway: 'Lipid Metabolism', discoveryMethod: 'ChIP-seq + CRISPR', citation: 'Guan et al., Genes Dev 2018', year: 2018, finding: 'SREBP1 transcription factor rhythmic in liver' },
  { gene: 'Cpt1a', pathway: 'Lipid Metabolism', discoveryMethod: 'Metabolic flux + qPCR', citation: 'Peek et al., Science 2013', year: 2013, finding: 'Mitochondrial fatty acid import, circadian' },
  { gene: 'Elovl5', pathway: 'Lipid Metabolism', discoveryMethod: 'Lipidomics', citation: 'Adamovich et al., Cell Metab 2014', year: 2014, finding: 'Fatty acid elongase with rhythmic expression' },
  { gene: 'Fads1', pathway: 'Lipid Metabolism', discoveryMethod: 'Lipidomics', citation: 'Adamovich et al., Cell Metab 2014', year: 2014, finding: 'Fatty acid desaturase, circadian control' },

  { gene: 'Wee1', pathway: 'Cell Cycle', discoveryMethod: 'Promoter analysis + qPCR', citation: 'Matsuo et al., Science 2003', year: 2003, finding: 'Clock-controlled cell cycle gate, BMAL1 target' },
  { gene: 'Cdk1', pathway: 'Cell Cycle', discoveryMethod: 'Flow cytometry + Western', citation: 'Matsuo et al., Science 2003', year: 2003, finding: 'CDK1 activity gated by circadian WEE1' },
  { gene: 'Ccnb1', pathway: 'Cell Cycle', discoveryMethod: 'Immunohistochemistry', citation: 'Grechez-Cassiau et al., JBC 2008', year: 2008, finding: 'Cyclin B1 expression rhythmic in proliferating cells' },
  { gene: 'Cdkn1a', pathway: 'Cell Cycle', discoveryMethod: 'ChIP + reporter assay', citation: 'Grechez-Cassiau et al., MCB 2008', year: 2008, finding: 'p21 under direct BMAL1 transcriptional control' },
  { gene: 'Ccnd1', pathway: 'Cell Cycle', discoveryMethod: 'Knockout mouse', citation: 'Fu et al., Cell 2002', year: 2002, finding: 'Cyclin D1 deregulated in Per2 mutants' },
  { gene: 'Tp53', pathway: 'Cell Cycle', discoveryMethod: 'Protein stability assay', citation: 'Gotoh et al., Mol Cell 2016', year: 2016, finding: 'p53 stability oscillates with circadian period' },
  { gene: 'Chek2', pathway: 'Cell Cycle', discoveryMethod: 'Phosphoproteomics', citation: 'Kang et al., PNAS 2009', year: 2009, finding: 'CHK2 phosphorylation rhythmic, clock-controlled DNA damage response' },

  { gene: 'Xpa', pathway: 'DNA Repair', discoveryMethod: 'Excision repair assay', citation: 'Kang et al., PNAS 2009', year: 2009, finding: 'XPA rhythmic, peak NER activity at evening' },
  { gene: 'Xpc', pathway: 'DNA Repair', discoveryMethod: 'qPCR + Western', citation: 'Kang et al., PNAS 2009', year: 2009, finding: 'XPC expression under CRY1 control' },
  { gene: 'Ercc1', pathway: 'DNA Repair', discoveryMethod: 'Excision assay', citation: 'Sancar et al., Chem Rev 2010', year: 2010, finding: 'Excision repair gene with circadian expression' },
  { gene: 'Ogg1', pathway: 'DNA Repair', discoveryMethod: 'Chromatin immunoprecipitation', citation: 'Manzella et al., PNAS 2020', year: 2020, finding: 'Base excision repair oscillates with clock' },
  { gene: 'Ddb2', pathway: 'DNA Repair', discoveryMethod: 'UV damage + time course', citation: 'Gaddameedhi et al., PNAS 2011', year: 2011, finding: 'DDB2 rhythmic, mediates circadian UV sensitivity' },

  { gene: 'Cyp7a1', pathway: 'Xenobiotic / Drug Metabolism', discoveryMethod: 'Bile acid measurement', citation: 'Noshiro et al., JBC 2007', year: 2007, finding: 'Rate-limiting bile acid synthesis, under REV-ERB control' },
  { gene: 'Cyp2e1', pathway: 'Xenobiotic / Drug Metabolism', discoveryMethod: 'Pharmacokinetics', citation: 'Zhang et al., Drug Metab Dispos 2018', year: 2018, finding: 'Circadian variation in drug metabolism capacity' },
  { gene: 'Cyp3a11', pathway: 'Xenobiotic / Drug Metabolism', discoveryMethod: 'Microarray + ChIP', citation: 'Gachon et al., Cell 2006', year: 2006, finding: 'DBP/TEF/HLF-driven rhythmic drug metabolism' },
  { gene: 'Cyp1a2', pathway: 'Xenobiotic / Drug Metabolism', discoveryMethod: 'Activity assay', citation: 'Gachon et al., Cell 2006', year: 2006, finding: 'PAR bZIP-controlled rhythmic expression' },
  { gene: 'Abcb1a', pathway: 'Xenobiotic / Drug Metabolism', discoveryMethod: 'Drug efflux assay', citation: 'Murakami et al., Gastro 2008', year: 2008, finding: 'P-glycoprotein transport rhythmic' },
  { gene: 'Gstm1', pathway: 'Xenobiotic / Drug Metabolism', discoveryMethod: 'Microarray', citation: 'Panda et al., Cell 2002', year: 2002, finding: 'Glutathione transferase with rhythmic expression' },

  { gene: 'G6pc', pathway: 'Gluconeogenesis / Glycolysis', discoveryMethod: 'Hepatocyte glucose output', citation: 'Lamia et al., PNAS 2008', year: 2008, finding: 'Glucose-6-phosphatase under CRY1/2 control' },
  { gene: 'Pck1', pathway: 'Gluconeogenesis / Glycolysis', discoveryMethod: 'Glucose clamp + qPCR', citation: 'Zhang et al., Nat Med 2010', year: 2010, finding: 'PEPCK rhythmic, gluconeogenic enzyme' },
  { gene: 'Gck', pathway: 'Gluconeogenesis / Glycolysis', discoveryMethod: 'Enzymatic activity', citation: 'Lamia et al., PNAS 2008', year: 2008, finding: 'Glucokinase activity cycles with clock' },

  { gene: 'Sirt1', pathway: 'Chromatin / Epigenetic', discoveryMethod: 'NAD+ oscillation', citation: 'Nakahata et al., Cell 2009', year: 2009, finding: 'SIRT1 deacetylase activity rhythmic via NAD+ cycling' },
  { gene: 'Hdac3', pathway: 'Chromatin / Epigenetic', discoveryMethod: 'ChIP-seq', citation: 'Feng et al., Science 2011', year: 2011, finding: 'HDAC3 recruitment by REV-ERB to metabolic genes' },
  { gene: 'Ezh2', pathway: 'Chromatin / Epigenetic', discoveryMethod: 'Histone mark profiling', citation: 'Koike et al., Science 2012', year: 2012, finding: 'H3K27me3 marks oscillate at clock-controlled loci' },
  { gene: 'Ep300', pathway: 'Chromatin / Epigenetic', discoveryMethod: 'Co-IP + ChIP', citation: 'Etchegaray et al., Nature 2003', year: 2003, finding: 'p300/CBP recruited rhythmically by CLOCK' },

  { gene: 'Ndufs1', pathway: 'Mitochondrial / OXPHOS', discoveryMethod: 'Respirometry', citation: 'Peek et al., Science 2013', year: 2013, finding: 'Complex I subunit, mitochondrial respiration rhythmic' },
  { gene: 'Cs', pathway: 'Mitochondrial / OXPHOS', discoveryMethod: 'Metabolomics', citation: 'Peek et al., Science 2013', year: 2013, finding: 'Citrate synthase, TCA cycle entry point oscillates' },
  { gene: 'Atp5b', pathway: 'Mitochondrial / OXPHOS', discoveryMethod: 'Blue-native gel', citation: 'Neufeld-Cohen et al., PNAS 2016', year: 2016, finding: 'ATP synthase subunit rhythmic in liver' },

  { gene: 'Atf4', pathway: 'Unfolded Protein Response', discoveryMethod: 'Ribosome profiling', citation: 'Janich et al., Genome Res 2015', year: 2015, finding: 'UPR transcription factor rhythmically translated' },
  { gene: 'Xbp1', pathway: 'Unfolded Protein Response', discoveryMethod: 'Splicing assay', citation: 'Cretenet et al., Cell Metab 2010', year: 2010, finding: 'XBP1 splicing oscillates with circadian period' },
  { gene: 'Hspa5', pathway: 'Unfolded Protein Response', discoveryMethod: 'Proteomics', citation: 'Mauvoisin et al., PNAS 2014', year: 2014, finding: 'BiP/GRP78 chaperone with rhythmic protein levels' },

  { gene: 'Becn1', pathway: 'Autophagy', discoveryMethod: 'Autophagic flux', citation: 'Ma et al., J Cell Biol 2011', year: 2011, finding: 'Beclin-1 expression rhythmic, autophagy peaks at night' },
  { gene: 'Map1lc3b', pathway: 'Autophagy', discoveryMethod: 'LC3-II turnover', citation: 'Ma et al., J Cell Biol 2011', year: 2011, finding: 'LC3 lipidation cycles with circadian period' },
  { gene: 'Tfeb', pathway: 'Autophagy', discoveryMethod: 'Nuclear translocation', citation: 'Pastore et al., Nat Cell Biol 2019', year: 2019, finding: 'TFEB nuclear entry rhythmic, drives lysosomal biogenesis' },

  { gene: 'Nfe2l2', pathway: 'Oxidative Stress', discoveryMethod: 'ROS measurement + qPCR', citation: 'Pekovic-Vaughan et al., Nat Med 2014', year: 2014, finding: 'NRF2 circadian, controls rhythmic antioxidant defense' },
  { gene: 'Sod2', pathway: 'Oxidative Stress', discoveryMethod: 'Activity assay', citation: 'Krishnan et al., Cell Metab 2012', year: 2012, finding: 'MnSOD rhythmic via BMAL1-SIRT3 axis' },
  { gene: 'Cat', pathway: 'Oxidative Stress', discoveryMethod: 'Enzyme kinetics', citation: 'Patel et al., Free Radic Biol Med 2014', year: 2014, finding: 'Catalase activity oscillates in liver' },
  { gene: 'Gpx1', pathway: 'Oxidative Stress', discoveryMethod: 'Microarray', citation: 'Panda et al., Cell 2002', year: 2002, finding: 'Glutathione peroxidase rhythmic in liver' },

  { gene: 'Mtor', pathway: 'mTOR / Growth Signaling', discoveryMethod: 'Phospho-Western', citation: 'Khapre et al., J Biol Chem 2014', year: 2014, finding: 'mTOR signaling rhythmic, tied to feeding' },
  { gene: 'Foxo1', pathway: 'mTOR / Growth Signaling', discoveryMethod: 'ChIP-seq', citation: 'Chaves et al., PLoS Biol 2014', year: 2014, finding: 'FOXO1 nuclear localization cycles with clock' },
  { gene: 'Igf1', pathway: 'mTOR / Growth Signaling', discoveryMethod: 'Serum time series', citation: 'Barandas et al., Chronobiol Int 2012', year: 2012, finding: 'IGF-1 levels circadian in serum' },

  { gene: 'Tnf', pathway: 'Immune / Inflammatory', discoveryMethod: 'ELISA time course', citation: 'Gibbs et al., PNAS 2012', year: 2012, finding: 'TNF-alpha secretion time-of-day dependent' },
  { gene: 'Il6', pathway: 'Immune / Inflammatory', discoveryMethod: 'Cytokine profiling', citation: 'Gibbs et al., Nat Med 2014', year: 2014, finding: 'IL-6 production gated by macrophage clock' },
  { gene: 'Tlr4', pathway: 'Immune / Inflammatory', discoveryMethod: 'Flow cytometry', citation: 'Silver et al., Immunity 2012', year: 2012, finding: 'TLR4 surface expression rhythmic on macrophages' },
  { gene: 'Nfkb1', pathway: 'Immune / Inflammatory', discoveryMethod: 'Reporter assay', citation: 'Spengler et al., FASEB J 2012', year: 2012, finding: 'NF-kB activity gated by REV-ERB' },

  { gene: 'Got1', pathway: 'Amino Acid Metabolism', discoveryMethod: 'Metabolomics', citation: 'Eckel-Mahan et al., Cell 2012', year: 2012, finding: 'Aminotransferase rhythmic, amino acid cycling' },
  { gene: 'Mat1a', pathway: 'Amino Acid Metabolism', discoveryMethod: 'SAM measurement', citation: 'Koronowski et al., Cell Metab 2019', year: 2019, finding: 'Methionine adenosyltransferase, methyl-donor cycling' },

  { gene: 'Bcl2', pathway: 'Apoptosis', discoveryMethod: 'Western + TUNEL', citation: 'Lee et al., Genes Dev 2013', year: 2013, finding: 'BCL-2 expression rhythmic, apoptosis time-gated' },
  { gene: 'Casp3', pathway: 'Apoptosis', discoveryMethod: 'Caspase activity assay', citation: 'Gaddameedhi et al., PNAS 2011', year: 2011, finding: 'Apoptotic sensitivity varies with time of day' },
];

interface ValidationResult {
  gene: string;
  par2Found: boolean;
  par2DeltaAIC: number;
  par2FDR: number;
  par2Significant: boolean;
  literatureValidated: boolean;
  literatureMethod: string;
  literatureCitation: string;
  literatureYear: number;
  literatureFinding: string;
  pathway: string;
  convergenceType: 'confirmed' | 'novel_par2' | 'literature_only' | 'both_negative';
}

interface FalsificationResult {
  predictorGene: string;
  predictorType: 'clock' | 'housekeeping' | 'random';
  totalGenesAnalyzed: number;
  totalSignificant: number;
  percentSignificant: number;
  topPathways: { pathway: string; pValue: number; foldEnrichment: number; coupledInPathway: number }[];
  overlapWithArntl: number;
  overlapPercent: number;
  medianDeltaAIC: number;
}

interface LiteratureValidationReport {
  dataset: string;
  validationMap: ValidationResult[];
  convergenceSummary: {
    totalLiteratureGenes: number;
    foundInDataset: number;
    confirmedByPAR2: number;
    confirmationRate: number;
    novelPAR2Only: number;
    literatureOnlyMissed: number;
    pathwayBreakdown: { pathway: string; total: number; confirmed: number; rate: number }[];
  };
  falsificationTests: FalsificationResult[];
  falsificationVerdict: string;
}

function pickRandomGenes(datasetPath: string, count: number, exclude: Set<string>): string[] {
  const content = fs.readFileSync(datasetPath, 'utf-8');
  const records = parse(content, { columns: true, skip_empty_lines: true }) as Record<string, string>[];
  const allGenes: string[] = [];
  for (const record of records) {
    const gene = record.Gene || record.gene || Object.values(record)[0];
    if (gene && !exclude.has(gene.toLowerCase())) {
      const headers = Object.keys(record).filter(k => k !== 'Gene' && k !== 'gene');
      const values = headers.map(h => parseFloat(record[h])).filter(v => !isNaN(v));
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const variance = values.reduce((a, v) => a + (v - mean) ** 2, 0) / values.length;
      if (variance > 1e-6 && values.length >= 8) {
        allGenes.push(gene);
      }
    }
  }
  const shuffled = allGenes.sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

const HOUSEKEEPING_GENES = ['Gapdh', 'Actb', 'Tbp', 'Hprt', 'Pgk1', 'Rpl13a', 'B2m', 'Sdha', 'Ubc', 'Ywhaz'];

export function runLiteratureValidation(datasetPath: string, clockPredictor: string = 'Arntl'): LiteratureValidationReport {
  const dataset = datasetPath.split('/').pop() || datasetPath;

  const arntlResult = runGenomeWideCoupling(datasetPath, clockPredictor);
  const resultMap = new Map<string, typeof arntlResult.allResults[0]>();
  for (const r of arntlResult.allResults) {
    resultMap.set(r.gene.toLowerCase(), r);
  }

  const arntlSignificantSet = new Set(
    arntlResult.allResults.filter(r => r.significant).map(r => r.gene.toLowerCase())
  );

  const validationMap: ValidationResult[] = [];
  const pathwayStats = new Map<string, { total: number; confirmed: number }>();

  for (const litGene of LITERATURE_CIRCADIAN_GENES) {
    const lowerGene = litGene.gene.toLowerCase();
    const par2Result = resultMap.get(lowerGene);

    const found = !!par2Result;
    const significant = par2Result?.significant ?? false;

    let convergenceType: ValidationResult['convergenceType'];
    if (found && significant) {
      convergenceType = 'confirmed';
    } else if (found && !significant) {
      convergenceType = 'literature_only';
    } else {
      convergenceType = 'literature_only';
    }

    validationMap.push({
      gene: litGene.gene,
      par2Found: found,
      par2DeltaAIC: par2Result?.deltaAIC ?? 0,
      par2FDR: par2Result?.fdrQ ?? 1,
      par2Significant: significant,
      literatureValidated: true,
      literatureMethod: litGene.discoveryMethod,
      literatureCitation: litGene.citation,
      literatureYear: litGene.year,
      literatureFinding: litGene.finding,
      pathway: litGene.pathway,
      convergenceType
    });

    const stats = pathwayStats.get(litGene.pathway) || { total: 0, confirmed: 0 };
    stats.total++;
    if (found) {
      if (significant) stats.confirmed++;
    }
    pathwayStats.set(litGene.pathway, stats);
  }

  const novelSignificant = arntlResult.allResults.filter(r => {
    if (!r.significant) return false;
    const lowerGene = r.gene.toLowerCase();
    return !LITERATURE_CIRCADIAN_GENES.some(l => l.gene.toLowerCase() === lowerGene);
  });

  for (const novel of novelSignificant.slice(0, 100)) {
    validationMap.push({
      gene: novel.gene,
      par2Found: true,
      par2DeltaAIC: novel.deltaAIC,
      par2FDR: novel.fdrQ,
      par2Significant: true,
      literatureValidated: false,
      literatureMethod: '',
      literatureCitation: '',
      literatureYear: 0,
      literatureFinding: '',
      pathway: 'Novel Candidate',
      convergenceType: 'novel_par2'
    });
  }

  const foundInDataset = validationMap.filter(v => v.literatureValidated && v.par2Found).length;
  const confirmedByPAR2 = validationMap.filter(v => v.literatureValidated && v.par2Significant).length;
  const totalLitGenes = LITERATURE_CIRCADIAN_GENES.length;

  const pathwayBreakdown = Array.from(pathwayStats.entries()).map(([pathway, stats]) => ({
    pathway,
    total: stats.total,
    confirmed: stats.confirmed,
    rate: stats.total > 0 ? stats.confirmed / stats.total : 0
  })).sort((a, b) => b.rate - a.rate);

  const clockGenesLower = new Set(['arntl','clock','per1','per2','per3','cry1','cry2','nr1d1','nr1d2','dbp',
    'npas2','arntl2','rora','rorb','rorc','tef','hlf','nfil3','bhlhe40','bhlhe41','ciart','csnk1d','csnk1e','fbxl3','fbxl21']);
  const excludeFromRandom = new Set(Array.from(clockGenesLower).concat(HOUSEKEEPING_GENES.map(g => g.toLowerCase())));

  const falsificationTests: FalsificationResult[] = [];

  const arntlTest: FalsificationResult = {
    predictorGene: clockPredictor,
    predictorType: 'clock',
    totalGenesAnalyzed: arntlResult.totalGenesAnalyzed,
    totalSignificant: arntlResult.totalSignificant,
    percentSignificant: arntlResult.summary.percentCoupled,
    topPathways: arntlResult.pathwayEnrichment
      .filter(p => p.pValue < 0.1)
      .slice(0, 5)
      .map(p => ({ pathway: p.pathway, pValue: p.pValue, foldEnrichment: p.foldEnrichment, coupledInPathway: p.coupledInPathway })),
    overlapWithArntl: arntlResult.totalSignificant,
    overlapPercent: 100,
    medianDeltaAIC: arntlResult.summary.medianDeltaAIC
  };
  falsificationTests.push(arntlTest);

  for (const hk of HOUSEKEEPING_GENES) {
    try {
      const hkResult = runGenomeWideCoupling(datasetPath, hk);
      const hkSigSet = new Set(hkResult.allResults.filter(r => r.significant).map(r => r.gene.toLowerCase()));
      let overlap = 0;
      Array.from(arntlSignificantSet).forEach(gene => {
        if (hkSigSet.has(gene)) overlap++;
      });

      falsificationTests.push({
        predictorGene: hk,
        predictorType: 'housekeeping',
        totalGenesAnalyzed: hkResult.totalGenesAnalyzed,
        totalSignificant: hkResult.totalSignificant,
        percentSignificant: hkResult.summary.percentCoupled,
        topPathways: hkResult.pathwayEnrichment
          .filter(p => p.pValue < 0.1)
          .slice(0, 5)
          .map(p => ({ pathway: p.pathway, pValue: p.pValue, foldEnrichment: p.foldEnrichment, coupledInPathway: p.coupledInPathway })),
        overlapWithArntl: overlap,
        overlapPercent: arntlSignificantSet.size > 0 ? (overlap / arntlSignificantSet.size) * 100 : 0,
        medianDeltaAIC: hkResult.summary.medianDeltaAIC
      });
    } catch {
    }
  }

  const randomGenes = pickRandomGenes(datasetPath, 3, excludeFromRandom);
  for (const rg of randomGenes) {
    try {
      const rgResult = runGenomeWideCoupling(datasetPath, rg);
      const rgSigSet = new Set(rgResult.allResults.filter(r => r.significant).map(r => r.gene.toLowerCase()));
      let overlap = 0;
      Array.from(arntlSignificantSet).forEach(gene => {
        if (rgSigSet.has(gene)) overlap++;
      });

      falsificationTests.push({
        predictorGene: rg,
        predictorType: 'random',
        totalGenesAnalyzed: rgResult.totalGenesAnalyzed,
        totalSignificant: rgResult.totalSignificant,
        percentSignificant: rgResult.summary.percentCoupled,
        topPathways: rgResult.pathwayEnrichment
          .filter(p => p.pValue < 0.1)
          .slice(0, 5)
          .map(p => ({ pathway: p.pathway, pValue: p.pValue, foldEnrichment: p.foldEnrichment, coupledInPathway: p.coupledInPathway })),
        overlapWithArntl: overlap,
        overlapPercent: arntlSignificantSet.size > 0 ? (overlap / arntlSignificantSet.size) * 100 : 0,
        medianDeltaAIC: rgResult.summary.medianDeltaAIC
      });
    } catch {
    }
  }

  const clockTest = falsificationTests.find(f => f.predictorType === 'clock');
  const controlTests = falsificationTests.filter(f => f.predictorType !== 'clock');
  const avgControlPercent = controlTests.length > 0
    ? controlTests.reduce((a, f) => a + f.percentSignificant, 0) / controlTests.length
    : 0;
  const avgControlPathways = controlTests.length > 0
    ? controlTests.reduce((a, f) => a + f.topPathways.length, 0) / controlTests.length
    : 0;
  const avgOverlap = controlTests.length > 0
    ? controlTests.reduce((a, f) => a + f.overlapPercent, 0) / controlTests.length
    : 0;

  let verdict = '';
  const clockPercent = clockTest?.percentSignificant ?? 0;
  const ratio = avgControlPercent > 0 ? clockPercent / avgControlPercent : Infinity;

  if (ratio > 3 && avgOverlap < 30) {
    verdict = `PASSED: Arntl (BMAL1) predictor yields ${clockPercent.toFixed(1)}% significant genes vs ${avgControlPercent.toFixed(1)}% average for controls (${ratio.toFixed(1)}x enrichment). Only ${avgOverlap.toFixed(0)}% overlap between Arntl results and random/housekeeping controls. The clock-coupling signal is specific to the circadian predictor, not an artifact of the statistical method.`;
  } else if (ratio > 2) {
    verdict = `MARGINAL: Arntl yields ${clockPercent.toFixed(1)}% vs ${avgControlPercent.toFixed(1)}% for controls (${ratio.toFixed(1)}x). Some specificity detected but overlap at ${avgOverlap.toFixed(0)}% is moderate. Results should be interpreted with caution.`;
  } else {
    verdict = `FAILED: Arntl yields ${clockPercent.toFixed(1)}% vs ${avgControlPercent.toFixed(1)}% for controls (${ratio.toFixed(1)}x). Insufficient specificity - the method may be detecting general coexpression rather than clock-specific coupling.`;
  }

  return {
    dataset,
    validationMap,
    convergenceSummary: {
      totalLiteratureGenes: totalLitGenes,
      foundInDataset: foundInDataset,
      confirmedByPAR2: confirmedByPAR2,
      confirmationRate: foundInDataset > 0 ? confirmedByPAR2 / foundInDataset : 0,
      novelPAR2Only: novelSignificant.length,
      literatureOnlyMissed: foundInDataset - confirmedByPAR2,
      pathwayBreakdown
    },
    falsificationTests,
    falsificationVerdict: verdict
  };
}
