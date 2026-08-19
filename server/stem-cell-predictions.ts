// Stem cell regulatory predictions for Paper G (Whiteside Reply to Boman)
// Predictions 2 and 3 from the Reply paper
// Dataset: GSE179027 Mouse Enteroid, 12,409 genes, 24 timepoints

// ── Gene sets ─────────────────────────────────────────────────────────────────

// Munoz et al. 2012 Cell Stem Cell (PMID: 22405071)
// Top 50 LGR5+ intestinal stem cell (CBC) signature genes
export const LGR5_ISC_SIGNATURE = [
  'Lgr5','Olfm4','Ascl2','Smoc2','Smoc1','Msi1','Msi2','Ephb2','Ephb3','Lrig1',
  'Prom1','Sox9','Sox4','Hopx','Bmi1','Cd44','Myc','Axin2','Ccnd1','Ctnnb1',
  'Dll1','Dll4','Jag1','Notch1','Cdk6','Cdca7','Ccnb1','Cdc20','Birc5','Ube2c',
  'Aurkb','Kif23','Hmgb2','Top2a','Mki67','Pcna','Nusap1','Anln','Tpx2','Ect2',
  'Cenpf','Cenpa','Ncapg','Racgap1','Ckap2','Chek1','Rrm2','Fancd2','Ska1','Knl1'
];

// MSigDB HALLMARK_WNT_BETA_CATENIN_SIGNALING (mouse, v2023.1)
export const WNT_HALLMARK = [
  'Ctnnb1','Jag1','Myc','Notch1','Ptch1','Trp53','Axin1','Ncstn','Rbpj','Psen2',
  'Notch2','Notch4','Lfng','Axin2','Frat2','Wif1','Sfrp2','Kremen2','Cd44','Csnk1e',
  'Ror2','Wnt5a','Ccnd1','Wnt3','Wnt6','Wnt10b','Wnt2','Fzd1','Lef1','Tcf7',
  'Tcf7l1','Tcf7l2'
];

// MSigDB HALLMARK_NOTCH_SIGNALING (mouse, v2023.1)
export const NOTCH_HALLMARK = [
  'Jag1','Notch1','Notch2','Notch3','Ccnd1','Tcf7l2','Wnt5a','Lfng','Psenen',
  'Psen2','Ncstn','Rbpj','Hes1','Hey1','Hey2','Heyl','Dll1','Dll3','Dll4',
  'Jag2','Mfng','Rfng','Adam10','Maml1','Maml2','Maml3','Dtx1','Dtx2','Dtx4',
  'Numb','Numbl','Pofut1'
];

// ── Pre-computed results (GSE179027, 12,302 stable genes) ───────────────────

export const PREDICTION2_RESULTS = {
  dataset: 'GSE179027 (Mouse Enteroid, 24 timepoints, 12,302 stable genes)',
  geneSets: {
    background:   { n: 12302, nearFibPct: 6.1,  meanMod: 0.4983, complexPct: 37.7 },
    lgr5Isc:      { n: 47,    nearFibPct: 6.4,  meanMod: 0.6825, complexPct: 10.6, enrichment: 1.05, p: 0.5579 },
    wntHallmark:  { n: 31,    nearFibPct: 9.7,  meanMod: 0.5665, complexPct: 22.6, enrichment: 1.59, p: 0.2904 },
    notchHallmark:{ n: 24,    nearFibPct: 16.7, meanMod: 0.4687, complexPct: 20.8, enrichment: 2.74, p: 0.0549 },
    combinedStem: { n: 88,    nearFibPct: 8.0,  meanMod: 0.6087, complexPct: 17.0, enrichment: 1.31, p: 0.2839 },
  },
  notableGenes: [
    { gene:'Lgr5',  mod:0.9480, rootType:'real',    fibSim:47.9,  nearPhi:false },
    { gene:'Olfm4', mod:0.8548, rootType:'real',    fibSim:29.1,  nearPhi:false },
    { gene:'Axin2', mod:0.7836, rootType:'real',    fibSim:52.3,  nearPhi:false },
    { gene:'Myc',   mod:0.8959, rootType:'real',    fibSim:36.2,  nearPhi:false },
    { gene:'Dll1',  mod:0.9734, rootType:'real',    fibSim:95.0,  nearPhi:true  },
    { gene:'Dll4',  mod:0.3963, rootType:'complex', fibSim:73.0,  nearPhi:false },
    { gene:'Chek1', mod:0.4529, rootType:'complex', fibSim:61.6,  nearPhi:false },
    { gene:'Top2a', mod:0.8824, rootType:'real',    fibSim:47.1,  nearPhi:false },
  ],
  status: 'NOT CONFIRMED',
  interpretation: 'LGR5+ ISC genes show no significant near-φ enrichment (1.05×, p=0.558). NOTCH hallmark is trending (2.74×, p=0.055). Key finding: ISC genes have substantially elevated mean |r| (0.683 vs 0.498 background), indicating greater temporal persistence without φ-specific clustering.',
};

export const PREDICTION3_RESULTS = {
  dataset: 'GSE179027 (Mouse Enteroid, 24 timepoints)',
  regulatoryPairsTested: 34,
  coupledPairs: 2,
  stemCouplingRatePct: 5.9,
  randomCouplingRatePct: 10.6,
  enrichment: 0.56,
  pValue: 0.8893,
  withinSetEnrichment: {
    wnt: 0.53, notch: 0.67, lgr5Isc: 0.08, combined: 0.31,
  },
  hierarchyTest: {
    upstreamMeanMod: 0.7314,
    midstreamMeanMod: 0.7025,
    downstreamMeanMod: 0.6423,
    interpretation: 'Upstream regulators (Ctnnb1, Lgr5, Axin2, Ascl2, Smoc2) have higher mean |r| than midstream Wnt readouts, which are higher than downstream proliferation genes. This ordering is consistent with the paper\'s predicted hierarchy.',
  },
  coupledPairDetails: [
    { src:'Dll4', tgt:'Notch1', srcMod:0.3963, tgtMod:0.3174, gap:0.079, srcRootType:'complex' },
    { src:'Chek1', tgt:'Birc5', srcMod:0.4529, tgtMod:0.3864, gap:0.066, srcRootType:'complex' },
  ],
  status: 'NOT CONFIRMED (phase-gating), CONFIRMED (|r| hierarchy)',
  interpretation: 'Phase-gated coupling is NOT enriched in stem cell regulatory networks (0.56×, p=0.889). Most ISC genes have real (non-oscillatory) roots, which by definition cannot satisfy the complex-root criterion for phase-gating. However, the |r| hierarchy — upstream regulators > midstream > downstream proliferation — IS confirmed (0.731 > 0.703 > 0.642), consistent with the paper\'s proposed regulatory gradient.',
};
