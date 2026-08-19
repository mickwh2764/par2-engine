import { DRUG_TARGET_DATABASE, DrugTargetEntry } from './data/annotations/drug_targets';

export interface ChronoGeneEntry {
  gene: string;
  mouseGene: string;
  peakZT: number;
  eigenvalue: number;
  phi1: number;
  phi2: number;
  periodHours: number;
  role: 'clock_core' | 'clock_output' | 'cell_cycle' | 'tumor_suppressor' | 'oncogene' | 'signaling';
  oscillationType: 'circadian' | 'cell_cycle_gated';
  peakPhaseLabel: string;
  biologicalContext: string;
  evidenceKey: string;
  optimalDosingWindowStart: number;
  optimalDosingWindowEnd: number;
  dosingRationale: string;
  interactionType: 'inhibitor_target' | 'activator_target';
}

export interface ChronoDosingResult {
  gene: string;
  entry: ChronoGeneEntry;
  drugs: DrugTargetEntry[];
  windowHours: number[];
  clockPosition: { peak: number; windowStart: number; windowEnd: number };
  conflictsWithClock: boolean;
}

const COS30 = Math.cos(Math.PI / 6);

function phi1FromLambda(lam: number) { return 2 * lam * COS30; }
function phi2FromLambda(lam: number) { return -(lam * lam); }
function thetaDeg(phi1: number, lam: number) {
  return (Math.acos(phi1 / (2 * lam)) * 180) / Math.PI;
}

function mod24(h: number) { return ((h % 24) + 24) % 24; }

function buildEntry(
  gene: string,
  mouseGene: string,
  peakZT: number,
  eigenvalue: number,
  role: ChronoGeneEntry['role'],
  oscillationType: ChronoGeneEntry['oscillationType'],
  peakPhaseLabel: string,
  biologicalContext: string,
  evidenceKey: string,
  interactionType: ChronoGeneEntry['interactionType'],
  dosingRationale: string,
): ChronoGeneEntry {
  const lam = eigenvalue;
  const phi1 = phi1FromLambda(lam);
  const phi2 = phi2FromLambda(lam);
  const theta = thetaDeg(phi1, lam);
  const periodPoints = 360 / theta;
  const periodHours = periodPoints * 2;
  const windowStart = mod24(peakZT + 3);
  const windowEnd = mod24(peakZT + 9);
  return {
    gene, mouseGene, peakZT, eigenvalue, phi1, phi2,
    periodHours: Math.round(periodHours * 10) / 10,
    role, oscillationType, peakPhaseLabel, biologicalContext, evidenceKey,
    optimalDosingWindowStart: windowStart,
    optimalDosingWindowEnd: windowEnd,
    dosingRationale,
    interactionType,
  };
}

export const CHRONO_GENE_DATABASE: ChronoGeneEntry[] = [
  buildEntry(
    'ARNTL', 'Arntl', 6, 0.840,
    'clock_core', 'circadian',
    'Morning peak (ZT6)',
    'Master clock transcription factor. BMAL1/CLOCK heterodimer drives E-box target transcription. Peak at ZT6 in liver and crypt epithelium.',
    'Storch et al. 2002 Nature; Akhtar et al. 2002 Science',
    'inhibitor_target',
    'Peak expression at ZT6. Inhibiting BMAL1 activity during its descending phase (ZT9–15) aligns with natural decline and minimises disruption of core clock architecture in healthy tissue.',
  ),
  buildEntry(
    'PER2', 'Per2', 14, 0.623,
    'clock_core', 'circadian',
    'Early afternoon peak (ZT14)',
    'Period 2 repressor, part of the negative feedback limb of the circadian clock. Peaks ~8 hours after BMAL1.',
    'Balsalobre et al. 2000 Science; GSE157357 WT |λ|=0.623',
    'inhibitor_target',
    'Peak at ZT14. Descending window ZT17–23 (evening to midnight) is the natural repression phase. Interventions targeting PER2-dependent cell cycle gating are most effective in this window.',
  ),
  buildEntry(
    'CRY1', 'Cry1', 18, 0.814,
    'clock_core', 'circadian',
    'Evening peak (ZT18)',
    'Cryptochrome 1 — delayed repressor relative to PER2. High persistence eigenvalue reflects tightly maintained oscillation.',
    'Ye et al. 2014 Cell; GSE157357 WT |λ|=0.814',
    'inhibitor_target',
    'Peak at ZT18. Vulnerability window ZT21–3 (night). CRY1 is the last clock repressor to peak; its declining phase overlaps with the G2/M gate, making ZT21–3 the highest-impact window for combined clock/cell-cycle intervention.',
  ),
  buildEntry(
    'NR1D1', 'Nr1d1', 5, 0.820,
    'clock_core', 'circadian',
    'Early morning peak (ZT5)',
    'REV-ERBα — nuclear receptor repressor of BMAL1 and inflammatory genes. Co-repressor of lipid, glucose, and immune rhythms.',
    'Preitner et al. 2002 Cell; Solt et al. 2012 Nature',
    'activator_target',
    'Peak at ZT5. REV-ERBα activators (SR9009) administered during ascending phase (ZT23–5) reinforce natural rhythm and suppress BMAL1 re-activation. Used in cancer as tumour-suppressive chronotherapy.',
  ),
  buildEntry(
    'DBP', 'Dbp', 9, 0.780,
    'clock_output', 'circadian',
    'Mid-morning peak (ZT9)',
    'D-box binding protein — PAR-bZIP transcription factor linking clock to metabolism and drug metabolism genes including CYP enzymes.',
    'Lopez-Molina et al. 1997 EMBO J',
    'inhibitor_target',
    'DBP drives expression of CYP1A2, CYP3A4, and other drug-metabolising enzymes. Peak at ZT9 means drug clearance is highest in mid-morning. Chronotherapy-naive dosing at ZT9 leads to faster drug elimination and lower bioavailability.',
  ),
  buildEntry(
    'WEE1', 'Wee1', 12, 0.655,
    'cell_cycle', 'cell_cycle_gated',
    'Midday peak (ZT12)',
    'WEE1 kinase phosphorylates CDK1 to inhibit mitotic entry. Its circadian gating creates a daily G2/M checkpoint at ZT12. Moderate eigenvalue in WT crypt (|λ|=0.655, corrected April 2026 from erroneous 0.093) reflects sustained circadian coupling; rises to 0.877 in ApcKO.',
    'Matsuo et al. 2003 Science; GSE157357 WT |λ|=0.655 (CORRECTED — prior 0.093 was artefact of non-chronological CSV ordering)',
    'inhibitor_target',
    'WEE1 peaks at ZT12 (mid-light phase). Adavosertib (AZD1775) administered during the descending window ZT15–21 targets maximum CDK1 dephosphorylation, when cells are entering mitosis. Administering at ZT3 (ascending phase) risks hitting quiescent cells with minimal CDK1 activity.',
  ),
  buildEntry(
    'CDK1', 'Cdk1', 15, 0.388,
    'cell_cycle', 'cell_cycle_gated',
    'Afternoon peak (ZT15)',
    'CDK1/CDC2 — master mitotic kinase. Antiphase to WEE1: CDK1 activity peaks as WEE1 declines. Peak expression in crypt organoids ~ZT15.',
    'Rosbash 2009 Cell; GSE157357 WT |λ|=0.388',
    'inhibitor_target',
    'CDK1 peak at ZT15. Descending window ZT18–0 (evening to midnight). CDK1 inhibitors (Dinaciclib) timed to the descending phase align drug action with maximum mitotic commitment and natural CDK1 withdrawal.',
  ),
  buildEntry(
    'CCNB1', 'Ccnb1', 11, 0.267,
    'cell_cycle', 'cell_cycle_gated',
    'Late morning peak (ZT11)',
    'Cyclin B1 — CDK1 regulatory partner. Co-peaks with mitotic entry checkpoint. Low eigenvalue indicates high oscillation amplitude relative to mean.',
    'Bjarnason & Jordan 2000 ChronoBiol Int; GSE157357 WT |λ|=0.267',
    'inhibitor_target',
    'Cyclin B1 peaks ~ZT11. Drugs targeting the CDK1-CyclinB1 complex are most effective during the descending window ZT14–20, when the complex is dissolving and the next mitotic cycle is being scheduled.',
  ),
  buildEntry(
    'CDKN1A', 'Cdkn1a', 2, 0.068,
    'tumor_suppressor', 'cell_cycle_gated',
    'Pre-dawn peak (ZT2)',
    'p21/CIP1 — CDK inhibitor and tumour suppressor. Antiphase to CDK1/WEE1; peak at ZT2 enforces G1 arrest during the rest phase when DNA repair is active.',
    'Kowalska et al. 2013 Proc Natl Acad Sci; GSE157357 WT |λ|=0.068',
    'activator_target',
    'p21 peaks at ZT2. Agents that enhance p21 stability (MDM2 inhibitors, HDAC inhibitors) administered during ZT0–4 work with the natural p21 peak to maximise G1 arrest efficiency and reduce replication stress.',
  ),
  buildEntry(
    'MYC', 'Myc', 10, 0.419,
    'oncogene', 'cell_cycle_gated',
    'Mid-morning peak (ZT10)',
    'MYC oncoprotein — transcription factor driving cell growth, metabolism, and cell cycle entry. Circadian gating via E-box elements links MYC to clock directly.',
    'Altman et al. 2015 Mol Cell; GSE157357 WT |λ|=0.419',
    'inhibitor_target',
    'MYC peaks at ZT10. Descending window ZT13–19 (afternoon to evening). BET bromodomain inhibitors (JQ1) and direct MYC inhibitors (Omomyc) timed to ZT13–19 target MYC-driven transcription at its most active phase and catch cells already committed to growth.',
  ),
  buildEntry(
    'MKI67', 'Mki67', 10, 0.331,
    'cell_cycle', 'cell_cycle_gated',
    'Mid-morning peak (ZT10)',
    'Ki-67 — proliferation marker and chromatin organiser during mitosis. Peaks in S/G2 phase of the circadian cell cycle.',
    'Cuylen et al. 2016 Nature; GSE157357 WT |λ|=0.331',
    'inhibitor_target',
    'Ki-67 peak at ZT10. Not a drug target directly, but its circadian peak identifies the optimal window for anti-proliferative agents: ZT13–19 when cells transitioning through S-phase are most vulnerable to DNA-damaging chemotherapy.',
  ),
  buildEntry(
    'LGR5', 'Lgr5', 6, 0.459,
    'signaling', 'circadian',
    'Morning peak (ZT6)',
    'LGR5 — intestinal stem cell marker and Wnt co-receptor. Circadian expression in crypt base columnar cells aligns with BMAL1 peak.',
    'Barker et al. 2007 Nature; GSE157357 WT |λ|=0.459',
    'inhibitor_target',
    'LGR5 peaks at ZT6 with stem cell activation. Wnt pathway inhibitors targeting LGR5+ tumour-initiating cells are predicted to be most effective during ZT9–15, when LGR5 is declining and Wnt pathway activity is being attenuated.',
  ),
  buildEntry(
    'EGFR', 'Egfr', 9, 0.720,
    'signaling', 'circadian',
    'Mid-morning peak (ZT9)',
    'EGFR — receptor tyrosine kinase. Circadian variation in EGFR expression and signalling documented in liver and gut epithelium.',
    'Zhang et al. 2020 PNAS (circadian EGFR); multiple GEO liver datasets',
    'inhibitor_target',
    'EGFR peaks ~ZT9. Descending window ZT12–18. Gefitinib/erlotinib administered at ZT12–18 align with EGFR signalling decline and may require lower doses for equivalent pathway suppression. DBP-driven CYP3A4 also peaks at ZT9, so drug clearance is fastest mid-morning — afternoon dosing (ZT12–18) improves bioavailability.',
  ),
  buildEntry(
    'VEGFA', 'Vegfa', 8, 0.740,
    'signaling', 'circadian',
    'Morning peak (ZT8)',
    'VEGF-A — primary angiogenic factor. Circadian expression documented in tumour vasculature, driven by HIF-1α and clock interaction.',
    'Koyanagi et al. 2003 PNAS (circadian VEGF); Bergers & Hanahan 2008',
    'inhibitor_target',
    'VEGFA peaks ~ZT8. Bevacizumab and VEGFR inhibitors (Sunitinib, Axitinib) timed to ZT11–17 (mid-day to late afternoon) target the descending phase when angiogenic commitment is highest and inhibitor efficacy is predicted to be maximal.',
  ),
  buildEntry(
    'TP53', 'Trp53', 20, 0.810,
    'tumor_suppressor', 'circadian',
    'Evening peak (ZT20)',
    'p53 — master tumour suppressor. Circadian accumulation peaks in the late dark phase, coordinating with DNA repair windows.',
    'Gotoh et al. 2014 Mol Cell Biol; Shiloh & Ziv 2013 Nat Rev Cancer',
    'activator_target',
    'p53 peaks at ZT20. MDM2 inhibitors (Nutlin-3, Idasanutlin) administered ZT20–2 work with the natural p53 accumulation window to maximise apoptotic signalling in p53 wild-type tumours.',
  ),
  buildEntry(
    'BCL2', 'Bcl2', 16, 0.760,
    'signaling', 'circadian',
    'Late afternoon peak (ZT16)',
    'BCL-2 — anti-apoptotic protein. Circadian gating coordinates survival signals with late dark-phase mitosis.',
    'Janich et al. 2011 Nature (circadian BCL2); Merrow et al. 2005',
    'inhibitor_target',
    'BCL-2 peaks at ZT16. Venetoclax (BCL-2 inhibitor) timed to ZT19–1 (descending phase) allows pro-apoptotic signals from BIM and BAX to dominate at a time when BCL-2 is naturally withdrawing.',
  ),
  buildEntry(
    'RORC', 'Rorc', 22, 0.800,
    'clock_output', 'circadian',
    'Late evening peak (ZT22)',
    'RORγ/RORc — nuclear receptor activating BMAL1 transcription and immune cell differentiation. Antiphase to REV-ERBα.',
    'Sato et al. 2004 Neuron; Zhang et al. 2015 Science',
    'inhibitor_target',
    'RORγ peaks at ZT22. RORγ inverse agonists (SR2211) administered ZT1–7 target the descending phase and reduce pro-inflammatory and tumour-promoting RORγ activity in Th17 cells and solid tumours.',
  ),
  buildEntry(
    'CRY2', 'Cry2', 10, 0.770,
    'clock_core', 'circadian',
    'Mid-morning peak (ZT10)',
    'Cryptochrome 2 — clock repressor. Earlier-peaking than CRY1; contributes to shorter-period regulation.',
    'Ye et al. 2014 Cell; Koike et al. 2012 Science',
    'inhibitor_target',
    'CRY2 peaks at ZT10. Descending window ZT13–19. KL001 (CRY stabiliser) administered ZT13–19 prevents CRY2 degradation during the natural decline, extending period and potentially resynchronising disrupted clocks in tumour tissue.',
  ),
  buildEntry(
    'NPAS2', 'Npas2', 8, 0.790,
    'clock_core', 'circadian',
    'Morning peak (ZT8)',
    'NPAS2 — paralog of CLOCK; dimerises with BMAL1 particularly in the forebrain and some peripheral tissues.',
    'DeBruyne et al. 2007 Neuron; Reick et al. 2001 Science',
    'inhibitor_target',
    'NPAS2 peaks at ZT8. Descending window ZT11–17. NPAS2 loss is associated with cancer risk in several studies; agents affecting NPAS2-BMAL1 complex stability are predicted to be most effective when the complex is naturally dissociating.',
  ),
];

const GENE_TISSUE_SOURCE: Record<string, string> = {
  ARNTL: 'GSE157357 · intestinal organoid', PER2: 'GSE157357 · intestinal organoid',
  CRY1:  'GSE157357 · intestinal organoid', NR1D1: 'GSE157357 · intestinal organoid',
  DBP:   'literature · multi-tissue',       WEE1:  'GSE157357 · intestinal organoid',
  CDK1:  'GSE157357 · intestinal organoid', CCNB1: 'GSE157357 · intestinal organoid',
  CDKN1A:'GSE157357 · intestinal organoid', MYC:   'GSE157357 · intestinal organoid',
  MKI67: 'GSE157357 · intestinal organoid', LGR5:  'GSE157357 · intestinal organoid',
  EGFR:  'liver datasets · literature',     VEGFA: 'liver datasets · literature',
  TP53:  'liver datasets · literature',     BCL2:  'literature · multi-tissue',
  RORC:  'literature · immune tissue',      CRY2:  'GSE157357 · intestinal organoid',
  NPAS2: 'literature · forebrain/peripheral',
};

const GENE_RESEARCH_COMPOUNDS: Record<string, { name: string; mechanism: string; note: string }[]> = {
  CRY1: [
    { name: 'KL001', mechanism: 'CRY1/2 stabiliser — prevents CRY ubiquitination and degradation', note: 'Extends circadian period in cell-based assays. Research tool only; no clinical trials.' },
    { name: 'TH301', mechanism: 'CRY1-selective stabiliser', note: 'More selective than KL001 for CRY1 over CRY2. Research stage.' },
  ],
  CRY2: [
    { name: 'KL001', mechanism: 'CRY1/2 stabiliser', note: 'Stabilises both CRY1 and CRY2; period-lengthening effect used in circadian resynchronisation studies.' },
  ],
  NR1D1: [
    { name: 'SR9009', mechanism: 'REV-ERBα/β agonist — enhances transcriptional repression of BMAL1 and inflammatory targets', note: 'Tumour-suppressive in melanoma, glioblastoma, and leukaemia cell lines. Not bioavailable orally in current form; research tool.' },
    { name: 'SR9011', mechanism: 'REV-ERBα/β agonist (close structural analogue of SR9009)', note: 'Similar mechanism to SR9009 with slightly improved pharmacokinetics. Research stage.' },
  ],
  RORC: [
    { name: 'SR2211', mechanism: 'RORγ inverse agonist — suppresses Th17 differentiation and tumour-promoting inflammation', note: 'Reduces IL-17 secretion and inhibits RORγ-expressing cancer cells. Research tool; clinical candidates in autoimmune pipeline.' },
    { name: 'Compound 101 (AZ)', mechanism: 'RORγt inverse agonist — clinical candidate for autoimmune disease', note: 'Entered Phase I trials (autoimmune). Chronotherapy application is preclinical hypothesis only.' },
  ],
};

const LOW_EIGENVALUE_GENES = new Set(['WEE1', 'CDKN1A']);

export function getChronotherapyDatabaseSummary() {
  const genes = CHRONO_GENE_DATABASE;
  return {
    genes: genes.map(g => {
      const drugs = DRUG_TARGET_DATABASE.filter(
        d => d.gene === g.gene || d.gene === g.mouseGene.toUpperCase()
      );
      const researchCompounds = GENE_RESEARCH_COMPOUNDS[g.gene] ?? [];
      return {
        gene: g.gene,
        mouseGene: g.mouseGene,
        peakZT: g.peakZT,
        eigenvalue: g.eigenvalue,
        phi1: Math.round(g.phi1 * 1000) / 1000,
        phi2: Math.round(g.phi2 * 1000) / 1000,
        periodHours: g.periodHours,
        role: g.role,
        oscillationType: g.oscillationType,
        peakPhaseLabel: g.peakPhaseLabel,
        biologicalContext: g.biologicalContext,
        evidenceKey: g.evidenceKey,
        optimalDosingWindowStart: g.optimalDosingWindowStart,
        optimalDosingWindowEnd: g.optimalDosingWindowEnd,
        dosingRationale: g.dosingRationale,
        interactionType: g.interactionType,
        drugs,
        hasDrug: drugs.length > 0,
        researchCompounds,
        hasResearchCompound: researchCompounds.length > 0,
        tissueSource: GENE_TISSUE_SOURCE[g.gene] ?? 'literature',
        lowEigenvalueWarning: LOW_EIGENVALUE_GENES.has(g.gene),
      };
    }),
    totalGenes: genes.length,
    genesWithDrugs: genes.filter(g =>
      DRUG_TARGET_DATABASE.some(d => d.gene === g.gene || d.gene === g.mouseGene.toUpperCase())
    ).length,
    methodology: {
      phaseAngle: 'θ = arccos(φ₁ / (2|λ|)) derived from AR(2) characteristic roots assuming circadian oscillation (T = 24h, sampling = 2h, 12 points/cycle)',
      dosingWindow: 'Optimal window = peakZT + 3h to peakZT + 9h (descending phase). Rationale: drug administration during natural decline requires lower dose for equivalent target suppression, reducing off-target toxicity.',
      eigenvalueSource: 'Primary source: GSE157357 WT intestinal organoids (AR(2) eigenvalue modulus). Secondary: liver circadian datasets (GSE11923, GSE54650) for non-intestinal genes. Literature-calibrated for genes not in primary datasets.',
      peakZTSource: 'Peak ZT times from published circadian transcriptomics literature (Storch et al. 2002, Hughes et al. 2009, Koike et al. 2012, Zhang et al. 2014) and CircaDB database cross-reference.',
    },
  };
}

export function getChronotherapyGene(geneSymbol: string) {
  const upper = geneSymbol.toUpperCase();
  const entry = CHRONO_GENE_DATABASE.find(
    g => g.gene === upper || g.mouseGene.toUpperCase() === upper
  );
  if (!entry) return null;
  const drugs = DRUG_TARGET_DATABASE.filter(
    d => d.gene === entry.gene || d.gene === entry.mouseGene.toUpperCase()
  );
  return { ...entry, drugs };
}
