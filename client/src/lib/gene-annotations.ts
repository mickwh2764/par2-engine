export interface GeneAnnotation {
  name: string;
  fullName: string;
  function: string;
  role: string;
  category: string;
  hierarchy: "Tier 1 — Regulator" | "Tier 2 — Effector" | "Tier 3 — Baseline" | "Functional";
}

const GENE_DB: Record<string, GeneAnnotation> = {
  "Arntl": { name: "Arntl", fullName: "Aryl Hydrocarbon Receptor Nuclear Translocator Like (BMAL1)", function: "Core transcription factor that heterodimerizes with CLOCK to drive circadian gene expression", role: "Master Clock Gene", category: "Circadian Clock", hierarchy: "Tier 1 — Regulator" },
  "Bmal1": { name: "Bmal1", fullName: "Brain and Muscle ARNT-Like 1", function: "Essential circadian clock component; its loss abolishes circadian rhythms", role: "Master Clock Gene", category: "Circadian Clock", hierarchy: "Tier 1 — Regulator" },
  "Clock": { name: "Clock", fullName: "Circadian Locomotor Output Cycles Kaput", function: "Histone acetyltransferase that partners with BMAL1 to activate E-box-containing clock-controlled genes", role: "Master Clock Gene", category: "Circadian Clock", hierarchy: "Tier 1 — Regulator" },
  "Per1": { name: "Per1", fullName: "Period Circadian Regulator 1", function: "Negative-arm repressor; accumulates and inhibits CLOCK:BMAL1 to close the feedback loop", role: "Clock Repressor", category: "Circadian Clock", hierarchy: "Tier 1 — Regulator" },
  "Per2": { name: "Per2", fullName: "Period Circadian Regulator 2", function: "Key negative-feedback repressor of CLOCK:BMAL1; its mutation shortens circadian period", role: "Clock Repressor", category: "Circadian Clock", hierarchy: "Tier 1 — Regulator" },
  "Per3": { name: "Per3", fullName: "Period Circadian Regulator 3", function: "Modulates circadian period length; linked to sleep timing preferences in humans", role: "Clock Modulator", category: "Circadian Clock", hierarchy: "Tier 1 — Regulator" },
  "Cry1": { name: "Cry1", fullName: "Cryptochrome Circadian Regulator 1", function: "Photolyase-related protein that represses CLOCK:BMAL1 transcriptional activity", role: "Clock Repressor", category: "Circadian Clock", hierarchy: "Tier 1 — Regulator" },
  "Cry2": { name: "Cry2", fullName: "Cryptochrome Circadian Regulator 2", function: "Partners with PER proteins to inhibit CLOCK:BMAL1; involved in DNA damage response", role: "Clock Repressor", category: "Circadian Clock", hierarchy: "Tier 1 — Regulator" },
  "Nr1d1": { name: "Nr1d1", fullName: "Nuclear Receptor Subfamily 1 Group D Member 1 (Rev-Erbα)", function: "Represses Bmal1 transcription; stabilizes the circadian oscillation", role: "Clock Stabilizer", category: "Circadian Clock", hierarchy: "Tier 1 — Regulator" },
  "Nr1d2": { name: "Nr1d2", fullName: "Nuclear Receptor Subfamily 1 Group D Member 2 (Rev-Erbβ)", function: "Works redundantly with Nr1d1 to repress Bmal1 and clock-controlled genes", role: "Clock Stabilizer", category: "Circadian Clock", hierarchy: "Tier 1 — Regulator" },
  "Rora": { name: "Rora", fullName: "RAR Related Orphan Receptor A", function: "Activates Bmal1 transcription; competes with REV-ERBs at ROR response elements", role: "Clock Activator", category: "Circadian Clock", hierarchy: "Tier 1 — Regulator" },
  "Rorc": { name: "Rorc", fullName: "RAR Related Orphan Receptor C", function: "Activates Bmal1 expression in specific tissues; involved in immune cell differentiation", role: "Clock Activator", category: "Circadian Clock", hierarchy: "Tier 1 — Regulator" },
  "Dbp": { name: "Dbp", fullName: "D-Box Binding PAR BZIP Transcription Factor", function: "Clock-controlled transcription factor; high-amplitude oscillator driving downstream target genes", role: "Clock Output", category: "Circadian Clock", hierarchy: "Tier 1 — Regulator" },
  "Tef": { name: "Tef", fullName: "Thyrotroph Embryonic Factor", function: "PAR bZIP transcription factor with robust circadian expression", role: "Clock Output", category: "Circadian Clock", hierarchy: "Tier 1 — Regulator" },
  "Hlf": { name: "Hlf", fullName: "Hepatic Leukemia Factor", function: "PAR bZIP family member involved in circadian output pathways", role: "Clock Output", category: "Circadian Clock", hierarchy: "Tier 1 — Regulator" },
  "Nfil3": { name: "Nfil3", fullName: "Nuclear Factor, Interleukin 3 Regulated (E4BP4)", function: "Transcriptional repressor opposing D-box activators; regulates immune cell development", role: "Clock Repressor / Immune", category: "Circadian Clock", hierarchy: "Tier 1 — Regulator" },
  "Npas2": { name: "Npas2", fullName: "Neuronal PAS Domain Protein 2", function: "CLOCK paralog that can substitute for CLOCK in the suprachiasmatic nucleus", role: "Clock Gene", category: "Circadian Clock", hierarchy: "Tier 1 — Regulator" },
  "Ciart": { name: "Ciart", fullName: "Circadian Associated Repressor of Transcription", function: "Represses clock gene expression; fine-tunes circadian amplitude", role: "Clock Modulator", category: "Circadian Clock", hierarchy: "Tier 1 — Regulator" },
  "Csnk1d": { name: "Csnk1d", fullName: "Casein Kinase 1 Delta", function: "Phosphorylates PER proteins to regulate their stability and nuclear entry", role: "Clock Kinase", category: "Circadian Clock", hierarchy: "Tier 1 — Regulator" },
  "Csnk1e": { name: "Csnk1e", fullName: "Casein Kinase 1 Epsilon", function: "Phosphorylates PER/CRY proteins; mutations cause familial advanced sleep phase", role: "Clock Kinase", category: "Circadian Clock", hierarchy: "Tier 1 — Regulator" },

  "Myc": { name: "Myc", fullName: "MYC Proto-Oncogene", function: "Master transcription factor driving proliferation; disrupts circadian clock when overexpressed", role: "Oncogene", category: "Cell Cycle / Cancer", hierarchy: "Tier 2 — Effector" },
  "Wee1": { name: "Wee1", fullName: "WEE1 G2 Checkpoint Kinase", function: "Inhibitory kinase gating mitotic entry; circadian-controlled to time cell division", role: "Cell Cycle Gatekeeper", category: "Cell Cycle", hierarchy: "Tier 2 — Effector" },
  "Cdk1": { name: "Cdk1", fullName: "Cyclin Dependent Kinase 1", function: "Master regulator of mitotic entry; its activity is gated by Wee1", role: "Mitotic Driver", category: "Cell Cycle", hierarchy: "Tier 2 — Effector" },
  "Ccnb1": { name: "Ccnb1", fullName: "Cyclin B1", function: "Activating partner of CDK1; accumulates in G2 and triggers mitosis", role: "Mitotic Cyclin", category: "Cell Cycle", hierarchy: "Tier 2 — Effector" },
  "Cdkn1a": { name: "Cdkn1a", fullName: "Cyclin Dependent Kinase Inhibitor 1A (p21)", function: "CDK inhibitor that arrests cell cycle at G1/S; induced by p53 and circadian signals", role: "Cell Cycle Inhibitor", category: "Cell Cycle", hierarchy: "Tier 2 — Effector" },
  "Ccnd1": { name: "Ccnd1", fullName: "Cyclin D1", function: "G1/S cyclin that promotes cell cycle progression; overexpressed in many cancers", role: "G1/S Cyclin", category: "Cell Cycle", hierarchy: "Tier 2 — Effector" },
  "Ccne1": { name: "Ccne1", fullName: "Cyclin E1", function: "G1/S transition cyclin; partners with CDK2 to initiate DNA replication", role: "G1/S Cyclin", category: "Cell Cycle", hierarchy: "Tier 2 — Effector" },
  "Ccne2": { name: "Ccne2", fullName: "Cyclin E2", function: "Redundant with Cyclin E1 for S-phase entry; overexpressed in breast cancer", role: "G1/S Cyclin", category: "Cell Cycle", hierarchy: "Tier 2 — Effector" },
  "Mcm6": { name: "Mcm6", fullName: "Minichromosome Maintenance Complex Component 6", function: "DNA helicase licensing DNA replication origins; essential for S-phase", role: "Replication Licensing", category: "Cell Cycle", hierarchy: "Tier 2 — Effector" },
  "Mki67": { name: "Mki67", fullName: "Marker of Proliferation Ki-67", function: "Proliferation marker expressed in all active cell cycle phases; absent in G0", role: "Proliferation Marker", category: "Cell Cycle", hierarchy: "Tier 2 — Effector" },
  "Tp53": { name: "Tp53", fullName: "Tumor Protein P53", function: "Master tumor suppressor controlling apoptosis, senescence, and DNA repair; regulated post-translationally by CRY", role: "Tumor Suppressor", category: "Cell Cycle / Cancer", hierarchy: "Tier 2 — Effector" },
  "Trp53": { name: "Trp53", fullName: "Transformation Related Protein 53 (mouse p53)", function: "Mouse homolog of TP53; master tumor suppressor controlling cell fate decisions", role: "Tumor Suppressor", category: "Cell Cycle / Cancer", hierarchy: "Tier 2 — Effector" },
  "Mdm2": { name: "Mdm2", fullName: "MDM2 Proto-Oncogene", function: "E3 ubiquitin ligase targeting p53 for degradation; major p53 negative regulator", role: "p53 Regulator", category: "Cell Cycle / Cancer", hierarchy: "Tier 2 — Effector" },
  "Atm": { name: "Atm", fullName: "ATM Serine/Threonine Kinase", function: "DNA double-strand break sensor activating checkpoint signaling cascade", role: "DNA Damage Sensor", category: "DNA Repair", hierarchy: "Tier 2 — Effector" },
  "Chek2": { name: "Chek2", fullName: "Checkpoint Kinase 2", function: "DNA damage checkpoint kinase; phosphorylates p53 and BRCA1 in response to double-strand breaks", role: "DNA Damage Checkpoint", category: "DNA Repair", hierarchy: "Tier 2 — Effector" },
  "Apc": { name: "Apc", fullName: "Adenomatous Polyposis Coli", function: "Tumor suppressor in Wnt signaling; its loss initiates colorectal cancer", role: "Tumor Suppressor", category: "Cancer", hierarchy: "Tier 2 — Effector" },
  "Lgr5": { name: "Lgr5", fullName: "Leucine Rich Repeat Containing G Protein-Coupled Receptor 5", function: "Wnt target gene and intestinal stem cell marker; marks crypt base columnar cells", role: "Stem Cell Marker", category: "Stem Cell", hierarchy: "Tier 2 — Effector" },
  "Axin2": { name: "Axin2", fullName: "Axin 2", function: "Wnt signaling negative regulator and target gene; used as Wnt activity readout", role: "Wnt Feedback", category: "Signaling", hierarchy: "Tier 2 — Effector" },
  "Ctnnb1": { name: "Ctnnb1", fullName: "Catenin Beta 1", function: "Wnt signaling effector and cell adhesion molecule; oncogenic when stabilized", role: "Wnt Signaling", category: "Signaling", hierarchy: "Tier 2 — Effector" },
  "Bcl2": { name: "Bcl2", fullName: "BCL2 Apoptosis Regulator", function: "Anti-apoptotic protein preventing mitochondrial outer membrane permeabilization", role: "Anti-Apoptotic", category: "Apoptosis", hierarchy: "Tier 2 — Effector" },
  "Bax": { name: "Bax", fullName: "BCL2 Associated X Apoptosis Regulator", function: "Pro-apoptotic protein forming mitochondrial pores; activated by p53", role: "Pro-Apoptotic", category: "Apoptosis", hierarchy: "Tier 2 — Effector" },
  "Pparg": { name: "Pparg", fullName: "Peroxisome Proliferator Activated Receptor Gamma", function: "Nuclear receptor driving adipogenesis and insulin sensitivity; therapeutic target for diabetes", role: "Adipogenesis Regulator", category: "Metabolic", hierarchy: "Tier 2 — Effector" },
  "Sirt1": { name: "Sirt1", fullName: "Sirtuin 1", function: "NAD+-dependent deacetylase linking metabolism to chromatin; deacetylates BMAL1", role: "Metabolic Sensor", category: "Epigenetic", hierarchy: "Tier 2 — Effector" },
  "Hif1a": { name: "Hif1a", fullName: "Hypoxia Inducible Factor 1 Subunit Alpha", function: "Master transcription factor of hypoxic response; cross-talks with circadian clock", role: "Hypoxia Sensor", category: "Signaling", hierarchy: "Tier 2 — Effector" },

  "Ppara": { name: "Ppara", fullName: "Peroxisome Proliferator Activated Receptor Alpha", function: "Nuclear receptor activating fatty acid oxidation genes; circadian-regulated", role: "Fat Oxidation Regulator", category: "Metabolic", hierarchy: "Functional" },
  "Ppard": { name: "Ppard", fullName: "Peroxisome Proliferator Activated Receptor Delta", function: "Nuclear receptor promoting fatty acid oxidation and energy expenditure", role: "Energy Expenditure", category: "Metabolic", hierarchy: "Functional" },
  "Ppargc1a": { name: "Ppargc1a", fullName: "PPARG Coactivator 1 Alpha (PGC-1α)", function: "Master regulator of mitochondrial biogenesis and oxidative metabolism", role: "Mitochondrial Biogenesis", category: "Metabolic", hierarchy: "Functional" },
  "Fasn": { name: "Fasn", fullName: "Fatty Acid Synthase", function: "Catalyzes de novo long-chain fatty acid synthesis from acetyl-CoA and malonyl-CoA", role: "Lipid Synthesis", category: "Metabolic", hierarchy: "Functional" },
  "Acaca": { name: "Acaca", fullName: "Acetyl-CoA Carboxylase Alpha", function: "Catalyzes the first step of fatty acid synthesis; regulated by AMPK", role: "Fatty Acid Synthesis", category: "Metabolic", hierarchy: "Functional" },
  "Hmgcr": { name: "Hmgcr", fullName: "HMG-CoA Reductase", function: "Rate-limiting enzyme in cholesterol biosynthesis; target of statin drugs", role: "Cholesterol Synthesis", category: "Metabolic", hierarchy: "Functional" },
  "Cyp7a1": { name: "Cyp7a1", fullName: "Cytochrome P450 7A1", function: "Rate-limiting enzyme converting cholesterol to bile acids; strongly circadian", role: "Bile Acid Synthesis", category: "Metabolic", hierarchy: "Functional" },
  "Gpx1": { name: "Gpx1", fullName: "Glutathione Peroxidase 1", function: "Reduces hydrogen peroxide and lipid hydroperoxides using glutathione", role: "Antioxidant Enzyme", category: "Metabolic", hierarchy: "Functional" },
  "Sod1": { name: "Sod1", fullName: "Superoxide Dismutase 1 (Cytoplasmic)", function: "Converts cytoplasmic superoxide radicals to hydrogen peroxide", role: "Antioxidant Defense", category: "Metabolic", hierarchy: "Functional" },
  "Sod2": { name: "Sod2", fullName: "Superoxide Dismutase 2 (Mitochondrial)", function: "Converts mitochondrial superoxide radicals to hydrogen peroxide", role: "Antioxidant Defense", category: "Metabolic", hierarchy: "Functional" },
  "Cat": { name: "Cat", fullName: "Catalase", function: "Decomposes hydrogen peroxide to water and oxygen in peroxisomes", role: "Antioxidant Enzyme", category: "Metabolic", hierarchy: "Functional" },
  "Gck": { name: "Gck", fullName: "Glucokinase", function: "Glucose sensor in pancreatic beta cells and liver; phosphorylates glucose", role: "Glucose Sensing", category: "Metabolic", hierarchy: "Functional" },
  "Pck1": { name: "Pck1", fullName: "Phosphoenolpyruvate Carboxykinase 1", function: "Rate-limiting enzyme in gluconeogenesis; strongly circadian in liver", role: "Gluconeogenesis", category: "Metabolic", hierarchy: "Functional" },
  "G6pc": { name: "G6pc", fullName: "Glucose-6-Phosphatase Catalytic Subunit", function: "Final enzyme in gluconeogenesis and glycogenolysis; releases free glucose", role: "Glucose Production", category: "Metabolic", hierarchy: "Functional" },
  "Fbp1": { name: "Fbp1", fullName: "Fructose-Bisphosphatase 1", function: "Gluconeogenic enzyme converting fructose-1,6-bisphosphate to fructose-6-phosphate", role: "Gluconeogenesis", category: "Metabolic", hierarchy: "Functional" },
  "Cs": { name: "Cs", fullName: "Citrate Synthase", function: "First enzyme of the TCA cycle; condenses acetyl-CoA with oxaloacetate", role: "TCA Cycle", category: "Metabolic", hierarchy: "Functional" },
  "Idh1": { name: "Idh1", fullName: "Isocitrate Dehydrogenase 1 (Cytoplasmic)", function: "TCA cycle enzyme; mutations cause gliomas via 2-hydroxyglutarate production", role: "TCA Cycle", category: "Metabolic", hierarchy: "Functional" },
  "Idh2": { name: "Idh2", fullName: "Isocitrate Dehydrogenase 2 (Mitochondrial)", function: "Mitochondrial TCA cycle enzyme; produces NADPH for antioxidant defense", role: "TCA Cycle", category: "Metabolic", hierarchy: "Functional" },
  "Cpt1a": { name: "Cpt1a", fullName: "Carnitine Palmitoyltransferase 1A", function: "Rate-limiting enzyme for mitochondrial fatty acid beta-oxidation", role: "Fat Transport", category: "Metabolic", hierarchy: "Functional" },
  "Acox1": { name: "Acox1", fullName: "Acyl-CoA Oxidase 1", function: "First enzyme of peroxisomal beta-oxidation of very long-chain fatty acids", role: "Peroxisomal Oxidation", category: "Metabolic", hierarchy: "Functional" },
  "Acadm": { name: "Acadm", fullName: "Acyl-CoA Dehydrogenase Medium Chain", function: "Mitochondrial enzyme for medium-chain fatty acid beta-oxidation", role: "Fat Oxidation", category: "Metabolic", hierarchy: "Functional" },
  "Scd1": { name: "Scd1", fullName: "Stearoyl-CoA Desaturase 1", function: "Introduces double bonds into fatty acids; key enzyme in lipogenesis", role: "Fatty Acid Desaturation", category: "Metabolic", hierarchy: "Functional" },
  "Hmgcs2": { name: "Hmgcs2", fullName: "HMG-CoA Synthase 2 (Mitochondrial)", function: "Rate-limiting enzyme in ketogenesis; produces ketone bodies during fasting", role: "Ketogenesis", category: "Metabolic", hierarchy: "Functional" },
  "Srebf1": { name: "Srebf1", fullName: "Sterol Regulatory Element Binding Transcription Factor 1", function: "Master regulator of lipogenic gene expression; activated by insulin signaling", role: "Lipid Gene Regulator", category: "Metabolic", hierarchy: "Functional" },
  "Elovl5": { name: "Elovl5", fullName: "Elongation of Very Long Chain Fatty Acids Protein 5", function: "Elongates C18-C22 polyunsaturated fatty acids", role: "Fatty Acid Elongation", category: "Metabolic", hierarchy: "Functional" },
  "Fads1": { name: "Fads1", fullName: "Fatty Acid Desaturase 1 (Delta-5)", function: "Desaturase in omega-3/6 PUFA synthesis pathway", role: "PUFA Synthesis", category: "Metabolic", hierarchy: "Functional" },
  "Nampt": { name: "Nampt", fullName: "Nicotinamide Phosphoribosyltransferase", function: "Rate-limiting enzyme in NAD+ biosynthesis; links circadian clock to metabolism", role: "Clock-Metabolism Link", category: "Metabolic", hierarchy: "Functional" },
  "Atp5a1": { name: "Atp5a1", fullName: "ATP Synthase F1 Subunit Alpha", function: "Major subunit of mitochondrial ATP synthase complex", role: "ATP Production", category: "Metabolic", hierarchy: "Functional" },
  "Ndufv1": { name: "Ndufv1", fullName: "NADH:Ubiquinone Oxidoreductase Core Subunit V1", function: "Complex I subunit containing the NADH binding site for electron transport", role: "Electron Transport", category: "Metabolic", hierarchy: "Functional" },
  "Cox4i1": { name: "Cox4i1", fullName: "Cytochrome C Oxidase Subunit 4I1", function: "Nuclear-encoded subunit of Complex IV; transfers electrons to oxygen", role: "Electron Transport", category: "Metabolic", hierarchy: "Functional" },
  "Slc2a1": { name: "Slc2a1", fullName: "Solute Carrier Family 2 Member 1 (GLUT1)", function: "Basal glucose transporter; ubiquitously expressed for constitutive glucose uptake", role: "Glucose Transport", category: "Metabolic", hierarchy: "Functional" },
  "Slc2a2": { name: "Slc2a2", fullName: "Solute Carrier Family 2 Member 2 (GLUT2)", function: "Low-affinity glucose transporter in liver, pancreas, intestine; glucose sensor", role: "Glucose Transport", category: "Metabolic", hierarchy: "Functional" },
  "Ogdh": { name: "Ogdh", fullName: "Oxoglutarate Dehydrogenase", function: "TCA cycle enzyme catalyzing oxidative decarboxylation of alpha-ketoglutarate", role: "TCA Cycle", category: "Metabolic", hierarchy: "Functional" },

  "Tnf": { name: "Tnf", fullName: "Tumor Necrosis Factor", function: "Pro-inflammatory cytokine activating NF-kB; central mediator of innate immunity", role: "Pro-inflammatory Cytokine", category: "Immune", hierarchy: "Functional" },
  "Il1b": { name: "Il1b", fullName: "Interleukin 1 Beta", function: "Pro-inflammatory cytokine released by activated macrophages; pyrogen", role: "Inflammatory Cytokine", category: "Immune", hierarchy: "Functional" },
  "Il6": { name: "Il6", fullName: "Interleukin 6", function: "Pleiotropic cytokine driving acute-phase response, fever, and B-cell maturation", role: "Inflammatory Cytokine", category: "Immune", hierarchy: "Functional" },
  "Il10": { name: "Il10", fullName: "Interleukin 10", function: "Anti-inflammatory cytokine suppressing macrophage activation and Th1 responses", role: "Anti-inflammatory Cytokine", category: "Immune", hierarchy: "Functional" },
  "Ifng": { name: "Ifng", fullName: "Interferon Gamma", function: "Type II interferon activating macrophages, enhancing antigen presentation, and Th1 immunity", role: "Immune Activator", category: "Immune", hierarchy: "Functional" },
  "Stat1": { name: "Stat1", fullName: "Signal Transducer and Activator of Transcription 1", function: "Mediates interferon signaling; activates antiviral and immune response genes", role: "Interferon Signaling", category: "Immune", hierarchy: "Functional" },
  "Stat3": { name: "Stat3", fullName: "Signal Transducer and Activator of Transcription 3", function: "Cytokine signaling mediator; promotes cell survival, proliferation, and immune modulation", role: "Cytokine Signaling", category: "Immune", hierarchy: "Functional" },
  "Irf1": { name: "Irf1", fullName: "Interferon Regulatory Factor 1", function: "Transcription factor mediating IFN-gamma signaling and antiviral gene activation", role: "Interferon Regulator", category: "Immune", hierarchy: "Functional" },
  "Irf7": { name: "Irf7", fullName: "Interferon Regulatory Factor 7", function: "Master regulator of type I interferon production; essential for antiviral defense", role: "Interferon Regulator", category: "Immune", hierarchy: "Functional" },
  "Nfkb1": { name: "Nfkb1", fullName: "Nuclear Factor Kappa B Subunit 1 (p50)", function: "Transcription factor controlling inflammation, immunity, and cell survival genes", role: "Inflammatory Regulator", category: "Immune", hierarchy: "Functional" },
  "Nfkb2": { name: "Nfkb2", fullName: "Nuclear Factor Kappa B Subunit 2 (p52)", function: "Non-canonical NF-kB subunit involved in lymphoid development and B-cell survival", role: "Inflammatory Regulator", category: "Immune", hierarchy: "Functional" },
  "Rela": { name: "Rela", fullName: "RELA Proto-Oncogene NF-kB Subunit (p65)", function: "Transcriptional activator subunit of NF-kB; drives inflammatory gene expression", role: "Inflammatory Activator", category: "Immune", hierarchy: "Functional" },
  "Tlr2": { name: "Tlr2", fullName: "Toll Like Receptor 2", function: "Innate immune receptor recognizing lipopeptides from Gram-positive bacteria", role: "Pattern Recognition Receptor", category: "Immune", hierarchy: "Functional" },
  "Tlr4": { name: "Tlr4", fullName: "Toll Like Receptor 4", function: "Innate immune receptor recognizing bacterial LPS; activates NF-kB signaling", role: "Pattern Recognition Receptor", category: "Immune", hierarchy: "Functional" },
  "Cd4": { name: "Cd4", fullName: "CD4 Antigen", function: "T-helper cell surface marker; co-receptor for MHC class II-mediated antigen recognition", role: "T Cell Marker", category: "Immune", hierarchy: "Functional" },
  "Cd8a": { name: "Cd8a", fullName: "CD8A Antigen", function: "Cytotoxic T cell surface marker; co-receptor for MHC class I recognition", role: "T Cell Marker", category: "Immune", hierarchy: "Functional" },
  "Cd19": { name: "Cd19", fullName: "CD19 Antigen", function: "B cell surface marker; part of B cell receptor signaling complex", role: "B Cell Marker", category: "Immune", hierarchy: "Functional" },
  "Cd68": { name: "Cd68", fullName: "CD68 Antigen", function: "Macrophage/monocyte lineage marker; lysosomal glycoprotein", role: "Macrophage Marker", category: "Immune", hierarchy: "Functional" },
  "Cxcl1": { name: "Cxcl1", fullName: "C-X-C Motif Chemokine Ligand 1", function: "Neutrophil-attracting chemokine; early inflammatory response mediator", role: "Chemokine", category: "Immune", hierarchy: "Functional" },
  "Cxcl10": { name: "Cxcl10", fullName: "C-X-C Motif Chemokine Ligand 10 (IP-10)", function: "Interferon-induced chemokine attracting T cells and NK cells", role: "Chemokine", category: "Immune", hierarchy: "Functional" },
  "Ccl2": { name: "Ccl2", fullName: "C-C Motif Chemokine Ligand 2 (MCP-1)", function: "Monocyte chemoattractant protein; recruits monocytes to inflammation sites", role: "Chemokine", category: "Immune", hierarchy: "Functional" },
  "Ccl5": { name: "Ccl5", fullName: "C-C Motif Chemokine Ligand 5 (RANTES)", function: "Chemokine recruiting T cells, eosinophils, and basophils to inflammation", role: "Chemokine", category: "Immune", hierarchy: "Functional" },
  "Ptprc": { name: "Ptprc", fullName: "Protein Tyrosine Phosphatase Receptor Type C (CD45)", function: "Pan-leukocyte marker; essential phosphatase for lymphocyte activation signaling", role: "Leukocyte Marker", category: "Immune", hierarchy: "Functional" },
  "Ifit1": { name: "Ifit1", fullName: "Interferon Induced Protein With Tetratricopeptide Repeats 1", function: "Antiviral effector protein induced by type I interferons", role: "Antiviral Effector", category: "Immune", hierarchy: "Functional" },
  "Junb": { name: "Junb", fullName: "JunB Proto-Oncogene, AP-1 Transcription Factor Subunit", function: "Immediate-early response gene in AP-1 complex; regulates inflammation and proliferation", role: "Immediate-Early Gene", category: "Immune", hierarchy: "Functional" },
  "Icos": { name: "Icos", fullName: "Inducible T Cell Costimulator", function: "T cell costimulatory receptor enhancing T cell activation and cytokine production", role: "T Cell Costimulator", category: "Immune", hierarchy: "Functional" },
  "Fcgr1": { name: "Fcgr1", fullName: "Fc Fragment of IgG Receptor Ia (CD64)", function: "High-affinity IgG receptor on monocytes/macrophages; mediates antibody-dependent phagocytosis", role: "Fc Receptor", category: "Immune", hierarchy: "Functional" },

  "Hdac1": { name: "Hdac1", fullName: "Histone Deacetylase 1", function: "Class I histone deacetylase removing acetyl groups from histones; gene silencing", role: "Chromatin Modifier", category: "Chromatin", hierarchy: "Functional" },
  "Hdac2": { name: "Hdac2", fullName: "Histone Deacetylase 2", function: "Class I histone deacetylase; often partners with HDAC1 in co-repressor complexes", role: "Chromatin Modifier", category: "Chromatin", hierarchy: "Functional" },
  "Hdac3": { name: "Hdac3", fullName: "Histone Deacetylase 3", function: "Recruited by REV-ERBs to repress metabolic genes in a circadian manner", role: "Chromatin Modifier", category: "Chromatin", hierarchy: "Functional" },
  "Hdac4": { name: "Hdac4", fullName: "Histone Deacetylase 4", function: "Class IIa HDAC that shuttles between nucleus and cytoplasm; signal-dependent gene repression", role: "Signal-Dependent Repressor", category: "Chromatin", hierarchy: "Functional" },
  "Sirt2": { name: "Sirt2", fullName: "Sirtuin 2", function: "Cytoplasmic NAD+-dependent deacetylase; deacetylates tubulin and cell cycle regulators", role: "NAD+ Deacetylase", category: "Chromatin", hierarchy: "Functional" },
  "Sirt3": { name: "Sirt3", fullName: "Sirtuin 3", function: "Mitochondrial NAD+-dependent deacetylase; regulates mitochondrial metabolism", role: "Mitochondrial Regulator", category: "Chromatin", hierarchy: "Functional" },
  "Sirt6": { name: "Sirt6", fullName: "Sirtuin 6", function: "Nuclear NAD+-dependent deacetylase; maintains telomere integrity and genome stability", role: "Genome Stability", category: "Chromatin", hierarchy: "Functional" },
  "Sirt7": { name: "Sirt7", fullName: "Sirtuin 7", function: "Nucleolar NAD+-dependent deacetylase; regulates ribosomal RNA transcription", role: "Ribosomal Regulator", category: "Chromatin", hierarchy: "Functional" },
  "Kat2a": { name: "Kat2a", fullName: "Lysine Acetyltransferase 2A (GCN5)", function: "Histone acetyltransferase activating gene expression; part of SAGA complex", role: "Chromatin Activator", category: "Chromatin", hierarchy: "Functional" },
  "Kat2b": { name: "Kat2b", fullName: "Lysine Acetyltransferase 2B (PCAF)", function: "Histone acetyltransferase and transcriptional coactivator; acetylates p53", role: "Chromatin Activator", category: "Chromatin", hierarchy: "Functional" },
  "Ep300": { name: "Ep300", fullName: "E1A Binding Protein P300", function: "Histone acetyltransferase and transcriptional coactivator bridging enhancers to promoters", role: "Transcriptional Coactivator", category: "Chromatin", hierarchy: "Functional" },
  "Crebbp": { name: "Crebbp", fullName: "CREB Binding Protein (CBP)", function: "Histone acetyltransferase paralog of p300; essential transcriptional coactivator", role: "Transcriptional Coactivator", category: "Chromatin", hierarchy: "Functional" },
  "Ezh2": { name: "Ezh2", fullName: "Enhancer of Zeste Homolog 2", function: "Polycomb complex methyltransferase placing H3K27me3 repressive marks", role: "Gene Silencer", category: "Chromatin", hierarchy: "Functional" },
  "Kdm5a": { name: "Kdm5a", fullName: "Lysine Demethylase 5A (JARID1A)", function: "H3K4me3 demethylase; interacts with circadian clock to modulate chromatin state", role: "Chromatin Modifier", category: "Chromatin", hierarchy: "Functional" },
  "Kdm1a": { name: "Kdm1a", fullName: "Lysine Demethylase 1A (LSD1)", function: "H3K4me1/2 and H3K9me1/2 demethylase; dual specificity gene regulator", role: "Chromatin Modifier", category: "Chromatin", hierarchy: "Functional" },
  "Dnmt1": { name: "Dnmt1", fullName: "DNA Methyltransferase 1", function: "Maintenance DNA methyltransferase preserving methylation patterns after replication", role: "DNA Methylation", category: "Chromatin", hierarchy: "Functional" },
  "Dnmt3a": { name: "Dnmt3a", fullName: "DNA Methyltransferase 3 Alpha", function: "De novo DNA methyltransferase establishing new methylation patterns", role: "DNA Methylation", category: "Chromatin", hierarchy: "Functional" },
  "Dnmt3b": { name: "Dnmt3b", fullName: "DNA Methyltransferase 3 Beta", function: "De novo DNA methyltransferase; essential for embryonic development", role: "DNA Methylation", category: "Chromatin", hierarchy: "Functional" },
  "Tet1": { name: "Tet1", fullName: "Tet Methylcytosine Dioxygenase 1", function: "Oxidizes 5-methylcytosine to 5-hydroxymethylcytosine; initiates DNA demethylation", role: "DNA Demethylation", category: "Chromatin", hierarchy: "Functional" },
  "Tet2": { name: "Tet2", fullName: "Tet Methylcytosine Dioxygenase 2", function: "DNA demethylation enzyme; frequently mutated in myeloid malignancies", role: "DNA Demethylation", category: "Chromatin", hierarchy: "Functional" },
  "Tet3": { name: "Tet3", fullName: "Tet Methylcytosine Dioxygenase 3", function: "DNA demethylation enzyme active in neurons and during zygotic reprogramming", role: "DNA Demethylation", category: "Chromatin", hierarchy: "Functional" },
  "Smarca4": { name: "Smarca4", fullName: "SWI/SNF Related Matrix Associated Actin Dependent Regulator of Chromatin A4 (BRG1)", function: "ATP-dependent chromatin remodeler; catalytic subunit of SWI/SNF complex", role: "Chromatin Remodeler", category: "Chromatin", hierarchy: "Functional" },
  "Arid1a": { name: "Arid1a", fullName: "AT-Rich Interaction Domain 1A", function: "SWI/SNF subunit targeting complex to specific genomic loci; tumor suppressor", role: "Chromatin Remodeler", category: "Chromatin", hierarchy: "Functional" },
  "Ctcf": { name: "Ctcf", fullName: "CCCTC-Binding Factor", function: "Insulator protein organizing 3D genome architecture and topological domains", role: "Genome Architecture", category: "Chromatin", hierarchy: "Functional" },
  "Suv39h1": { name: "Suv39h1", fullName: "Suppressor of Variegation 3-9 Homolog 1", function: "H3K9 methyltransferase establishing heterochromatin; pericentromeric silencing", role: "Heterochromatin", category: "Chromatin", hierarchy: "Functional" },
  "Setdb1": { name: "Setdb1", fullName: "SET Domain Bifurcated Histone Lysine Methyltransferase 1", function: "H3K9me3 methyltransferase silencing retroelements and developmental genes", role: "Gene Silencer", category: "Chromatin", hierarchy: "Functional" },

  "Notch1": { name: "Notch1", fullName: "Notch Receptor 1", function: "Transmembrane receptor for cell-cell signaling controlling cell fate decisions", role: "Developmental Receptor", category: "Signaling", hierarchy: "Functional" },
  "Notch2": { name: "Notch2", fullName: "Notch Receptor 2", function: "Notch pathway receptor with tissue-specific roles in development and homeostasis", role: "Developmental Receptor", category: "Signaling", hierarchy: "Functional" },
  "Hes1": { name: "Hes1", fullName: "Hes Family BHLH Transcription Factor 1", function: "Notch target gene oscillating with ~2h ultradian period; regulates neurogenesis", role: "Notch Target", category: "Signaling", hierarchy: "Functional" },
  "Hey1": { name: "Hey1", fullName: "HES Related Family BHLH Transcription Factor With YRPW Motif 1", function: "Notch target gene involved in cardiovascular development and somitogenesis", role: "Notch Target", category: "Signaling", hierarchy: "Functional" },
  "Dll1": { name: "Dll1", fullName: "Delta Like Canonical Notch Ligand 1", function: "Notch ligand driving lateral inhibition during cell fate specification", role: "Notch Ligand", category: "Signaling", hierarchy: "Functional" },
  "Jag1": { name: "Jag1", fullName: "Jagged Canonical Notch Ligand 1", function: "Notch ligand involved in bile duct development; mutated in Alagille syndrome", role: "Notch Ligand", category: "Signaling", hierarchy: "Functional" },
  "Wnt3a": { name: "Wnt3a", fullName: "Wnt Family Member 3A", function: "Canonical Wnt ligand activating beta-catenin signaling for stem cell maintenance", role: "Wnt Ligand", category: "Signaling", hierarchy: "Functional" },
  "Wnt5a": { name: "Wnt5a", fullName: "Wnt Family Member 5A", function: "Non-canonical Wnt ligand regulating cell polarity and migration", role: "Wnt Ligand", category: "Signaling", hierarchy: "Functional" },
  "Dkk1": { name: "Dkk1", fullName: "Dickkopf WNT Signaling Pathway Inhibitor 1", function: "Wnt antagonist blocking LRP5/6 co-receptor; inhibits canonical Wnt signaling", role: "Wnt Inhibitor", category: "Signaling", hierarchy: "Functional" },
  "Shh": { name: "Shh", fullName: "Sonic Hedgehog Signaling Molecule", function: "Morphogen controlling tissue patterning, neural tube, and limb development", role: "Morphogen", category: "Signaling", hierarchy: "Functional" },
  "Gli1": { name: "Gli1", fullName: "GLI Family Zinc Finger 1", function: "Hedgehog pathway transcriptional activator; readout of pathway activity", role: "Hedgehog Target", category: "Signaling", hierarchy: "Functional" },
  "Gli2": { name: "Gli2", fullName: "GLI Family Zinc Finger 2", function: "Primary Hedgehog pathway activator; processes to activator or repressor form", role: "Hedgehog Effector", category: "Signaling", hierarchy: "Functional" },
  "Ptch1": { name: "Ptch1", fullName: "Patched 1", function: "Hedgehog receptor; tumor suppressor in basal cell carcinoma (Gorlin syndrome)", role: "Hedgehog Receptor", category: "Signaling", hierarchy: "Functional" },
  "Smo": { name: "Smo", fullName: "Smoothened, Frizzled Class Receptor", function: "Hedgehog signal transducer; relieved from Patched inhibition upon Hh binding", role: "Hedgehog Transducer", category: "Signaling", hierarchy: "Functional" },
  "Mapk1": { name: "Mapk1", fullName: "Mitogen-Activated Protein Kinase 1 (ERK2)", function: "Central kinase in RAS-RAF-MEK-ERK pathway; drives proliferation and differentiation", role: "Growth Signaling", category: "Signaling", hierarchy: "Functional" },
  "Mapk3": { name: "Mapk3", fullName: "Mitogen-Activated Protein Kinase 3 (ERK1)", function: "MAPK/ERK pathway kinase; phosphorylates transcription factors for gene activation", role: "Growth Signaling", category: "Signaling", hierarchy: "Functional" },
  "Akt1": { name: "Akt1", fullName: "AKT Serine/Threonine Kinase 1", function: "Central kinase in PI3K-AKT pathway promoting cell survival and growth", role: "Survival Signaling", category: "Signaling", hierarchy: "Functional" },
  "Akt2": { name: "Akt2", fullName: "AKT Serine/Threonine Kinase 2", function: "Insulin-responsive AKT isoform; regulates glucose metabolism", role: "Metabolic Signaling", category: "Signaling", hierarchy: "Functional" },
  "Pten": { name: "Pten", fullName: "Phosphatase and Tensin Homolog", function: "Tumor suppressor phosphatase opposing PI3K/AKT signaling", role: "Tumor Suppressor", category: "Signaling", hierarchy: "Functional" },
  "Mtor": { name: "Mtor", fullName: "Mechanistic Target of Rapamycin Kinase", function: "Central growth/nutrient sensor controlling protein synthesis and autophagy", role: "Growth Signaling Hub", category: "Signaling", hierarchy: "Functional" },
  "Egfr": { name: "Egfr", fullName: "Epidermal Growth Factor Receptor", function: "Receptor tyrosine kinase driving cell proliferation; commonly mutated in cancer", role: "Growth Receptor", category: "Signaling", hierarchy: "Functional" },
  "Erbb2": { name: "Erbb2", fullName: "Erb-B2 Receptor Tyrosine Kinase 2 (HER2)", function: "Oncogenic receptor tyrosine kinase; amplified in breast cancer; trastuzumab target", role: "Growth Receptor", category: "Signaling", hierarchy: "Functional" },
  "Fgfr1": { name: "Fgfr1", fullName: "Fibroblast Growth Factor Receptor 1", function: "Receptor tyrosine kinase for FGF ligands; drives development and tissue repair", role: "Growth Receptor", category: "Signaling", hierarchy: "Functional" },
  "Vegfa": { name: "Vegfa", fullName: "Vascular Endothelial Growth Factor A", function: "Key angiogenic factor promoting blood vessel formation; hypoxia-induced", role: "Angiogenesis", category: "Signaling", hierarchy: "Functional" },
  "Tgfb1": { name: "Tgfb1", fullName: "Transforming Growth Factor Beta 1", function: "Cytokine regulating cell growth, differentiation, fibrosis, and immune suppression", role: "Growth Factor", category: "Signaling", hierarchy: "Functional" },
  "Smad2": { name: "Smad2", fullName: "SMAD Family Member 2", function: "TGF-beta signal transducer; phosphorylated by TGF-beta receptors to activate transcription", role: "TGF-beta Signaling", category: "Signaling", hierarchy: "Functional" },
  "Smad3": { name: "Smad3", fullName: "SMAD Family Member 3", function: "TGF-beta pathway effector activating target gene transcription", role: "TGF-beta Signaling", category: "Signaling", hierarchy: "Functional" },
  "Smad4": { name: "Smad4", fullName: "SMAD Family Member 4", function: "Common-mediator SMAD; central hub for TGF-beta/BMP signaling; tumor suppressor", role: "TGF-beta Hub", category: "Signaling", hierarchy: "Functional" },
  "Bmp2": { name: "Bmp2", fullName: "Bone Morphogenetic Protein 2", function: "TGF-beta superfamily ligand inducing bone and cartilage formation", role: "Morphogen", category: "Signaling", hierarchy: "Functional" },
  "Bmp4": { name: "Bmp4", fullName: "Bone Morphogenetic Protein 4", function: "BMP ligand regulating mesoderm patterning and tooth/limb development", role: "Morphogen", category: "Signaling", hierarchy: "Functional" },
  "Rptor": { name: "Rptor", fullName: "Regulatory Associated Protein of MTOR Complex 1 (Raptor)", function: "Scaffold protein of mTORC1 complex; mediates substrate recognition", role: "mTOR Complex", category: "Signaling", hierarchy: "Functional" },
  "Fzd1": { name: "Fzd1", fullName: "Frizzled Class Receptor 1", function: "Wnt receptor of the Frizzled family; transduces canonical Wnt signals", role: "Wnt Receptor", category: "Signaling", hierarchy: "Functional" },
  "Fzd7": { name: "Fzd7", fullName: "Frizzled Class Receptor 7", function: "Wnt receptor critical for intestinal stem cell maintenance and Wnt signaling", role: "Wnt Receptor", category: "Signaling", hierarchy: "Functional" },
  "Lrp5": { name: "Lrp5", fullName: "LDL Receptor Related Protein 5", function: "Wnt co-receptor; mutations cause bone density disorders", role: "Wnt Co-Receptor", category: "Signaling", hierarchy: "Functional" },
  "Lrp6": { name: "Lrp6", fullName: "LDL Receptor Related Protein 6", function: "Wnt co-receptor forming signalosome with Frizzled for canonical Wnt activation", role: "Wnt Co-Receptor", category: "Signaling", hierarchy: "Functional" },
  "Rspo1": { name: "Rspo1", fullName: "R-Spondin 1", function: "Wnt signaling potentiator that stabilizes Frizzled receptors via LGR4/5 binding", role: "Wnt Potentiator", category: "Signaling", hierarchy: "Functional" },
  "Foxo1": { name: "Foxo1", fullName: "Forkhead Box O1", function: "Transcription factor promoting gluconeogenesis, apoptosis, and stress resistance", role: "Metabolic Regulator", category: "Signaling", hierarchy: "Functional" },
  "Igf1": { name: "Igf1", fullName: "Insulin Like Growth Factor 1", function: "Growth hormone mediator stimulating cell growth, proliferation, and survival", role: "Growth Factor", category: "Signaling", hierarchy: "Functional" },

  "Brca1": { name: "Brca1", fullName: "BRCA1 DNA Repair Associated", function: "Tumor suppressor involved in homologous recombination DNA repair", role: "Tumor Suppressor / DNA Repair", category: "DNA Repair", hierarchy: "Tier 2 — Effector" },
  "Brca2": { name: "Brca2", fullName: "BRCA2 DNA Repair Associated", function: "Mediates RAD51 loading onto ssDNA for homologous recombination repair", role: "HR Repair", category: "DNA Repair", hierarchy: "Tier 2 — Effector" },
  "Rad51": { name: "Rad51", fullName: "RAD51 Recombinase", function: "Recombinase catalyzing strand invasion during homologous recombination repair", role: "Recombinase", category: "DNA Repair", hierarchy: "Functional" },
  "Rad50": { name: "Rad50", fullName: "RAD50 Double Strand Break Repair Protein", function: "MRN complex component tethering broken DNA ends for repair", role: "DSB Repair", category: "DNA Repair", hierarchy: "Functional" },
  "Xrcc1": { name: "Xrcc1", fullName: "X-Ray Repair Cross Complementing 1", function: "Scaffold protein coordinating base excision repair and single-strand break repair", role: "BER Scaffold", category: "DNA Repair", hierarchy: "Functional" },
  "Xrcc4": { name: "Xrcc4", fullName: "X-Ray Repair Cross Complementing 4", function: "Non-homologous end joining factor stabilizing DNA Ligase IV at break sites", role: "NHEJ Factor", category: "DNA Repair", hierarchy: "Functional" },
  "Ercc1": { name: "Ercc1", fullName: "ERCC Excision Repair 1", function: "Endonuclease in nucleotide excision repair; essential for interstrand crosslink repair", role: "NER Nuclease", category: "DNA Repair", hierarchy: "Functional" },
  "Ercc2": { name: "Ercc2", fullName: "ERCC Excision Repair 2 (XPD)", function: "TFIIH helicase subunit; unwinds DNA around damage for nucleotide excision repair", role: "NER Helicase", category: "DNA Repair", hierarchy: "Functional" },
  "Mlh1": { name: "Mlh1", fullName: "MutL Homolog 1", function: "Mismatch repair protein; its loss causes microsatellite instability and Lynch syndrome", role: "Mismatch Repair", category: "DNA Repair", hierarchy: "Functional" },
  "Msh2": { name: "Msh2", fullName: "MutS Homolog 2", function: "Mismatch recognition protein initiating mismatch repair; Lynch syndrome gene", role: "Mismatch Repair", category: "DNA Repair", hierarchy: "Functional" },
  "Msh6": { name: "Msh6", fullName: "MutS Homolog 6", function: "Partners with MSH2 to recognize single base mismatches and small insertions", role: "Mismatch Repair", category: "DNA Repair", hierarchy: "Functional" },
  "Pms2": { name: "Pms2", fullName: "PMS1 Homolog 2", function: "MutLα complex partner with MLH1; endonuclease in mismatch repair", role: "Mismatch Repair", category: "DNA Repair", hierarchy: "Functional" },
  "Xpa": { name: "Xpa", fullName: "XPA DNA Damage Recognition and Repair Factor", function: "Nucleotide excision repair factor verifying DNA damage; circadian-controlled in liver", role: "NER Verification", category: "DNA Repair", hierarchy: "Functional" },
  "Xpc": { name: "Xpc", fullName: "XPC Complex Subunit", function: "Initiates global genome nucleotide excision repair by recognizing helix-distorting lesions", role: "DNA Damage Sensor", category: "DNA Repair", hierarchy: "Functional" },
  "Ddb2": { name: "Ddb2", fullName: "Damage Specific DNA Binding Protein 2", function: "UV-damaged DNA binding protein; recruits NER machinery to cyclobutane pyrimidine dimers", role: "UV Damage Sensor", category: "DNA Repair", hierarchy: "Functional" },
  "Ogg1": { name: "Ogg1", fullName: "8-Oxoguanine DNA Glycosylase", function: "Base excision repair enzyme removing oxidized guanine (8-oxoG) from DNA", role: "Oxidative DNA Repair", category: "DNA Repair", hierarchy: "Functional" },
  "Apex1": { name: "Apex1", fullName: "Apurinic/Apyrimidinic Endodeoxyribonuclease 1", function: "Major AP endonuclease in base excision repair; cleaves abasic sites", role: "BER Endonuclease", category: "DNA Repair", hierarchy: "Functional" },
  "Lig1": { name: "Lig1", fullName: "DNA Ligase 1", function: "Seals nicks during DNA replication and long-patch base excision repair", role: "DNA Ligase", category: "DNA Repair", hierarchy: "Functional" },
  "Lig3": { name: "Lig3", fullName: "DNA Ligase 3", function: "Seals nicks in short-patch base excision repair; partners with XRCC1", role: "DNA Ligase", category: "DNA Repair", hierarchy: "Functional" },
  "Lig4": { name: "Lig4", fullName: "DNA Ligase 4", function: "Essential ligase for non-homologous end joining of double-strand breaks", role: "NHEJ Ligase", category: "DNA Repair", hierarchy: "Functional" },
  "Parp1": { name: "Parp1", fullName: "Poly(ADP-Ribose) Polymerase 1", function: "DNA damage sensor catalyzing PARylation; recruits repair factors to breaks", role: "DNA Damage Sensor", category: "DNA Repair", hierarchy: "Functional" },
  "Parp2": { name: "Parp2", fullName: "Poly(ADP-Ribose) Polymerase 2", function: "Backup PARP enzyme for base excision repair; synthetic lethal with BRCA", role: "DNA Repair Enzyme", category: "DNA Repair", hierarchy: "Functional" },
  "Polb": { name: "Polb", fullName: "DNA Polymerase Beta", function: "Gap-filling polymerase in base excision repair; single-nucleotide insertion", role: "BER Polymerase", category: "DNA Repair", hierarchy: "Functional" },
  "Fancd2": { name: "Fancd2", fullName: "FA Complementation Group D2", function: "Fanconi anemia pathway protein monoubiquitinated during interstrand crosslink repair", role: "ICL Repair", category: "DNA Repair", hierarchy: "Functional" },
  "Fanca": { name: "Fanca", fullName: "FA Complementation Group A", function: "Core complex member of Fanconi anemia pathway; ubiquitinates FANCD2", role: "ICL Repair", category: "DNA Repair", hierarchy: "Functional" },
  "H2afx": { name: "H2afx", fullName: "H2A Histone Family Member X (γH2AX)", function: "Histone variant phosphorylated at double-strand breaks; damage marker (γH2AX foci)", role: "DSB Marker", category: "DNA Repair", hierarchy: "Functional" },

  "Lgr5_stem": { name: "Lgr5", fullName: "LGR5 (Stem Cell Context)", function: "Wnt target gene marking intestinal stem cells at crypt base", role: "Stem Cell Marker", category: "Stem Cell", hierarchy: "Tier 2 — Effector" },
  "Ascl2": { name: "Ascl2", fullName: "Achaete-Scute Family BHLH Transcription Factor 2", function: "Wnt target essential for intestinal stem cell maintenance", role: "Stem Cell TF", category: "Stem Cell", hierarchy: "Functional" },
  "Smoc2": { name: "Smoc2", fullName: "SPARC Related Modular Calcium Binding 2", function: "Intestinal stem cell marker; marks Lgr5+ stem cells", role: "Stem Cell Marker", category: "Stem Cell", hierarchy: "Functional" },
  "Olfm4": { name: "Olfm4", fullName: "Olfactomedin 4", function: "Robust human intestinal stem cell marker; anti-apoptotic glycoprotein", role: "Stem Cell Marker", category: "Stem Cell", hierarchy: "Functional" },
  "Bmi1": { name: "Bmi1", fullName: "BMI1 Proto-Oncogene, Polycomb Ring Finger", function: "Polycomb complex protein marking +4 reserve stem cells in intestine", role: "Reserve Stem Cell", category: "Stem Cell", hierarchy: "Functional" },
  "Sox2": { name: "Sox2", fullName: "SRY-Box Transcription Factor 2", function: "Core pluripotency factor; essential for embryonic stem cell self-renewal", role: "Pluripotency Factor", category: "Stem Cell", hierarchy: "Functional" },
  "Sox9": { name: "Sox9", fullName: "SRY-Box Transcription Factor 9", function: "Stem/progenitor marker in intestine and cartilage; Wnt-regulated", role: "Progenitor Marker", category: "Stem Cell", hierarchy: "Functional" },
  "Pou5f1": { name: "Pou5f1", fullName: "POU Class 5 Homeobox 1 (Oct4)", function: "Core pluripotency transcription factor for embryonic stem cell identity", role: "Pluripotency Factor", category: "Stem Cell", hierarchy: "Functional" },
  "Nanog": { name: "Nanog", fullName: "Nanog Homeobox", function: "Pluripotency transcription factor preventing differentiation of ES cells", role: "Pluripotency Factor", category: "Stem Cell", hierarchy: "Functional" },
  "Klf4": { name: "Klf4", fullName: "Kruppel Like Factor 4", function: "Pluripotency factor and Yamanaka reprogramming factor; tumor suppressor in gut", role: "Reprogramming Factor", category: "Stem Cell", hierarchy: "Functional" },
  "Lin28a": { name: "Lin28a", fullName: "Lin-28 Homolog A", function: "RNA-binding protein blocking let-7 miRNA maturation; promotes stemness", role: "Stemness Regulator", category: "Stem Cell", hierarchy: "Functional" },
  "Aldh1a1": { name: "Aldh1a1", fullName: "Aldehyde Dehydrogenase 1 Family Member A1", function: "Retinaldehyde dehydrogenase; cancer stem cell marker via ALDEFLUOR assay", role: "Cancer Stem Cell Marker", category: "Stem Cell", hierarchy: "Functional" },
  "Prom1": { name: "Prom1", fullName: "Prominin 1 (CD133)", function: "Transmembrane protein marking stem/progenitor cells; cancer stem cell marker", role: "Stem Cell Marker", category: "Stem Cell", hierarchy: "Functional" },
  "Cd44": { name: "Cd44", fullName: "CD44 Antigen", function: "Cell adhesion receptor; cancer stem cell marker in multiple tumor types", role: "Cancer Stem Cell Marker", category: "Stem Cell", hierarchy: "Functional" },
  "Lrig1": { name: "Lrig1", fullName: "Leucine Rich Repeats And Ig Like Domains 1", function: "EGFR negative regulator marking quiescent stem cells at +4 position", role: "Quiescent Stem Cell", category: "Stem Cell", hierarchy: "Functional" },
  "Hopx": { name: "Hopx", fullName: "HOP Homeobox", function: "Marks slowly cycling reserve stem cells; interconvertible with Lgr5+ cells", role: "Reserve Stem Cell", category: "Stem Cell", hierarchy: "Functional" },
  "Tert": { name: "Tert", fullName: "Telomerase Reverse Transcriptase", function: "Catalytic subunit of telomerase maintaining telomere length in stem and cancer cells", role: "Telomere Maintenance", category: "Stem Cell", hierarchy: "Functional" },

  "Gapdh": { name: "Gapdh", fullName: "Glyceraldehyde-3-Phosphate Dehydrogenase", function: "Glycolytic enzyme and common housekeeping reference gene", role: "Housekeeping / Glycolysis", category: "Housekeeping", hierarchy: "Tier 3 — Baseline" },
  "Actb": { name: "Actb", fullName: "Beta-Actin", function: "Cytoskeletal structural protein; widely used as expression normalization control", role: "Housekeeping / Cytoskeleton", category: "Housekeeping", hierarchy: "Tier 3 — Baseline" },
  "Hprt": { name: "Hprt", fullName: "Hypoxanthine Phosphoribosyltransferase", function: "Purine salvage pathway enzyme; frequently used as stable reference gene", role: "Housekeeping / Purine Salvage", category: "Housekeeping", hierarchy: "Tier 3 — Baseline" },
  "Tbp": { name: "Tbp", fullName: "TATA-Box Binding Protein", function: "General transcription factor for RNA Polymerase II; used as housekeeping reference", role: "Housekeeping / Transcription", category: "Housekeeping", hierarchy: "Tier 3 — Baseline" },
  "B2m": { name: "B2m", fullName: "Beta-2-Microglobulin", function: "MHC class I component; constitutively expressed reference gene", role: "Housekeeping / Immune Surface", category: "Housekeeping", hierarchy: "Tier 3 — Baseline" },
  "Rplp0": { name: "Rplp0", fullName: "Ribosomal Protein Lateral Stalk Subunit P0", function: "60S ribosomal subunit component; stable reference for qPCR normalization", role: "Housekeeping / Ribosomal", category: "Housekeeping", hierarchy: "Tier 3 — Baseline" },
  "Pgk1": { name: "Pgk1", fullName: "Phosphoglycerate Kinase 1", function: "Glycolytic enzyme catalyzing ATP generation; widely used housekeeping gene", role: "Housekeeping / Glycolysis", category: "Housekeeping", hierarchy: "Tier 3 — Baseline" },
  "Ppia": { name: "Ppia", fullName: "Peptidylprolyl Isomerase A (Cyclophilin A)", function: "Prolyl isomerase involved in protein folding; stable reference gene", role: "Housekeeping / Protein Folding", category: "Housekeeping", hierarchy: "Tier 3 — Baseline" },
  "Gusb": { name: "Gusb", fullName: "Beta-Glucuronidase", function: "Lysosomal enzyme; stable housekeeping reference across many tissue types", role: "Housekeeping / Lysosomal", category: "Housekeeping", hierarchy: "Tier 3 — Baseline" },
  "Sdha": { name: "Sdha", fullName: "Succinate Dehydrogenase Complex Flavoprotein Subunit A", function: "Complex II subunit linking TCA cycle to electron transport chain", role: "Housekeeping / Mitochondrial", category: "Housekeeping", hierarchy: "Tier 3 — Baseline" },
  "Ubc": { name: "Ubc", fullName: "Ubiquitin C", function: "Polyubiquitin gene providing ubiquitin for protein degradation pathway", role: "Housekeeping / Ubiquitin", category: "Housekeeping", hierarchy: "Tier 3 — Baseline" },
  "Ywhaz": { name: "Ywhaz", fullName: "Tyrosine 3-Monooxygenase/Tryptophan 5-Monooxygenase Activation Protein Zeta", function: "14-3-3 protein family member; scaffold in signaling pathways; stable reference gene", role: "Housekeeping / Signaling Scaffold", category: "Housekeeping", hierarchy: "Tier 3 — Baseline" },
  "Hmbs": { name: "Hmbs", fullName: "Hydroxymethylbilane Synthase", function: "Heme biosynthesis enzyme; stable housekeeping reference gene", role: "Housekeeping / Heme Synthesis", category: "Housekeeping", hierarchy: "Tier 3 — Baseline" },
  "Aldoa": { name: "Aldoa", fullName: "Aldolase Fructose-Bisphosphate A", function: "Glycolytic enzyme splitting fructose-1,6-bisphosphate; highly expressed in muscle", role: "Housekeeping / Glycolysis", category: "Housekeeping", hierarchy: "Tier 3 — Baseline" },
  "Eno1": { name: "Eno1", fullName: "Enolase 1", function: "Glycolytic enzyme converting 2-phosphoglycerate to phosphoenolpyruvate", role: "Housekeeping / Glycolysis", category: "Housekeeping", hierarchy: "Tier 3 — Baseline" },
  "Ldha": { name: "Ldha", fullName: "Lactate Dehydrogenase A", function: "Converts pyruvate to lactate in anaerobic glycolysis; Warburg effect marker", role: "Housekeeping / Glycolysis", category: "Housekeeping", hierarchy: "Tier 3 — Baseline" },
  "Tpi1": { name: "Tpi1", fullName: "Triosephosphate Isomerase 1", function: "Glycolytic enzyme interconverting glyceraldehyde-3P and DHAP", role: "Housekeeping / Glycolysis", category: "Housekeeping", hierarchy: "Tier 3 — Baseline" },
  "Rpl13a": { name: "Rpl13a", fullName: "Ribosomal Protein L13a", function: "60S ribosomal subunit component; commonly used housekeeping reference", role: "Housekeeping / Ribosomal", category: "Housekeeping", hierarchy: "Tier 3 — Baseline" },
  "Rps18": { name: "Rps18", fullName: "Ribosomal Protein S18", function: "40S ribosomal subunit component; stable reference gene in most tissues", role: "Housekeeping / Ribosomal", category: "Housekeeping", hierarchy: "Tier 3 — Baseline" },
  "Polr2a": { name: "Polr2a", fullName: "RNA Polymerase II Subunit A", function: "Largest subunit of RNA Polymerase II; catalyzes mRNA synthesis", role: "Housekeeping / Transcription", category: "Housekeeping", hierarchy: "Tier 3 — Baseline" },
  "Eef1a1": { name: "Eef1a1", fullName: "Eukaryotic Translation Elongation Factor 1 Alpha 1", function: "Delivers aminoacyl-tRNAs to the ribosome during translation elongation", role: "Housekeeping / Translation", category: "Housekeeping", hierarchy: "Tier 3 — Baseline" },
  "Eif4a2": { name: "Eif4a2", fullName: "Eukaryotic Translation Initiation Factor 4A2", function: "RNA helicase unwinding mRNA secondary structure for translation initiation", role: "Housekeeping / Translation", category: "Housekeeping", hierarchy: "Tier 3 — Baseline" },
  "Tuba1a": { name: "Tuba1a", fullName: "Tubulin Alpha 1a", function: "Major microtubule component; structural protein for cell division and transport", role: "Housekeeping / Cytoskeleton", category: "Housekeeping", hierarchy: "Tier 3 — Baseline" },
  "Tubb5": { name: "Tubb5", fullName: "Tubulin Beta 5 Class I", function: "Beta-tubulin isoform forming microtubules; constitutively expressed", role: "Housekeeping / Cytoskeleton", category: "Housekeeping", hierarchy: "Tier 3 — Baseline" },

  "Atf4": { name: "Atf4", fullName: "Activating Transcription Factor 4", function: "Stress-responsive transcription factor activated during ER stress and amino acid deprivation", role: "Stress Response", category: "Stress Response", hierarchy: "Functional" },
  "Xbp1": { name: "Xbp1", fullName: "X-Box Binding Protein 1", function: "Transcription factor activated by IRE1 splicing during ER stress; drives chaperone expression", role: "ER Stress Response", category: "Stress Response", hierarchy: "Functional" },
  "Hspa5": { name: "Hspa5", fullName: "Heat Shock Protein Family A Member 5 (BiP/GRP78)", function: "ER chaperone sensing unfolded proteins; master regulator of unfolded protein response", role: "ER Chaperone", category: "Stress Response", hierarchy: "Functional" },
  "Nfe2l2": { name: "Nfe2l2", fullName: "Nuclear Factor Erythroid 2 Like 2 (NRF2)", function: "Master regulator of antioxidant response; activates ARE-containing genes", role: "Antioxidant Master Regulator", category: "Stress Response", hierarchy: "Functional" },
  "Becn1": { name: "Becn1", fullName: "Beclin 1", function: "Initiates autophagosome formation; links autophagy to apoptosis regulation", role: "Autophagy Initiator", category: "Autophagy", hierarchy: "Functional" },
  "Map1lc3b": { name: "Map1lc3b", fullName: "Microtubule Associated Protein 1 Light Chain 3 Beta (LC3B)", function: "Autophagosome membrane protein; its lipidation is the gold-standard autophagy marker", role: "Autophagy Marker", category: "Autophagy", hierarchy: "Functional" },
  "Tfeb": { name: "Tfeb", fullName: "Transcription Factor EB", function: "Master regulator of lysosomal biogenesis and autophagy gene expression", role: "Autophagy Regulator", category: "Autophagy", hierarchy: "Functional" },

  "Casp3": { name: "Casp3", fullName: "Caspase 3", function: "Executioner caspase cleaving cellular substrates during apoptosis", role: "Apoptosis Executor", category: "Apoptosis", hierarchy: "Functional" },
  "Got1": { name: "Got1", fullName: "Glutamic-Oxaloacetic Transaminase 1 (AST)", function: "Cytoplasmic aminotransferase catalyzing aspartate-glutamate interconversion", role: "Amino Acid Metabolism", category: "Metabolic", hierarchy: "Functional" },
  "Mat1a": { name: "Mat1a", fullName: "Methionine Adenosyltransferase 1A", function: "Liver-specific enzyme producing S-adenosylmethionine (SAM), the universal methyl donor", role: "Methyl Donor Synthesis", category: "Metabolic", hierarchy: "Functional" },
  "Kras": { name: "Kras", fullName: "KRAS Proto-Oncogene GTPase", function: "Small GTPase transducing growth signals from receptor tyrosine kinases", role: "Oncogene", category: "Cancer", hierarchy: "Tier 2 — Effector" },

  "Ndufs1": { name: "Ndufs1", fullName: "NADH:Ubiquinone Oxidoreductase Core Subunit S1", function: "Largest subunit of mitochondrial Complex I; essential for electron transport", role: "Electron Transport", category: "Metabolic", hierarchy: "Functional" },
  "Atp5b": { name: "Atp5b", fullName: "ATP Synthase F1 Subunit Beta", function: "Catalytic subunit of mitochondrial ATP synthase generating ATP from proton gradient", role: "ATP Production", category: "Metabolic", hierarchy: "Functional" },

  "Cyp2e1": { name: "Cyp2e1", fullName: "Cytochrome P450 2E1", function: "Metabolizes ethanol, acetaminophen, and small molecules; generates reactive oxygen species", role: "Xenobiotic Metabolism", category: "Drug Metabolism", hierarchy: "Functional" },
  "Cyp3a11": { name: "Cyp3a11", fullName: "Cytochrome P450 3A11 (mouse Cyp3a4)", function: "Major drug-metabolizing enzyme; processes ~50% of clinical drugs", role: "Drug Metabolism", category: "Drug Metabolism", hierarchy: "Functional" },
  "Cyp1a2": { name: "Cyp1a2", fullName: "Cytochrome P450 1A2", function: "Metabolizes caffeine, theophylline, and aromatic amines; circadian-regulated", role: "Drug Metabolism", category: "Drug Metabolism", hierarchy: "Functional" },
  "Abcb1a": { name: "Abcb1a", fullName: "ATP Binding Cassette B1a (P-glycoprotein)", function: "Efflux transporter pumping drugs out of cells; determines drug bioavailability", role: "Drug Efflux", category: "Drug Metabolism", hierarchy: "Functional" },
  "Gstm1": { name: "Gstm1", fullName: "Glutathione S-Transferase Mu 1", function: "Phase II detoxification enzyme conjugating glutathione to electrophilic compounds", role: "Detoxification", category: "Drug Metabolism", hierarchy: "Functional" },
};

const CATEGORY_TO_HIERARCHY: Record<string, GeneAnnotation["hierarchy"]> = {
  "clock": "Tier 1 — Regulator",
  "target": "Tier 2 — Effector",
  "housekeeping": "Tier 3 — Baseline",
  "immune": "Functional",
  "metabolic": "Functional",
  "chromatin": "Functional",
  "signaling": "Functional",
  "dna_repair": "Functional",
  "stem": "Functional",
  "other": "Functional",
};

const CATEGORY_LABELS: Record<string, string> = {
  "clock": "Circadian Clock",
  "target": "Cell Cycle / Cancer",
  "housekeeping": "Housekeeping",
  "immune": "Immune",
  "metabolic": "Metabolic",
  "chromatin": "Chromatin",
  "signaling": "Signaling",
  "dna_repair": "DNA Repair",
  "stem": "Stem Cell",
  "other": "Unclassified",
};

const CLOCK_SET = new Set(['PER1','PER2','PER3','CRY1','CRY2','CLOCK','ARNTL','BMAL1','NR1D1','NR1D2','RORA','RORC','DBP','TEF','HLF','NFIL3','NPAS2']);
const TARGET_SET = new Set(['MYC','CCND1','CCNB1','CDK1','WEE1','CDKN1A','LGR5','AXIN2','CTNNB1','APC','TP53','TRP53','MDM2','ATM','CHEK2','BCL2','BAX','PPARG','SIRT1','HIF1A','CCNE1','CCNE2','MCM6','MKI67']);
const HOUSEKEEPING_SET = new Set(['GAPDH','ACTB','HPRT','TBP','B2M','RPLP0','PGK1','PPIA','GUSB','SDHA','TUBB5','UBC','YWHAZ','HMBS','ALDOA','ENO1','LDHA','TPI1','RPL13A','RPS18','POLR2A','EEF1A1','EIF4A2']);
const IMMUNE_SET = new Set(['TNF','IL1B','IL6','IL10','IFNG','STAT1','STAT3','IRF1','IRF7','NFKB1','NFKB2','RELA','TLR2','TLR4','CD4','CD8A','CD19','CD68','FCGR1','CXCL1','CXCL10','CCL2','CCL5','ICOS','PTPRC']);
const METABOLIC_SET = new Set(['PPARA','PPARD','PPARGC1A','FASN','ACACA','HMGCR','CYP7A1','GPX1','SOD1','SOD2','CAT','GLUT1','SLC2A1','SLC2A2','GCK','PCK1','G6PC','FBP1','CS','IDH1','IDH2','OGDH','NDUFV1','COX4I1','ATP5A1','ACOX1','CPT1A','ACADM']);
const CHROMATIN_SET = new Set(['HDAC1','HDAC2','HDAC3','HDAC4','SIRT2','SIRT3','SIRT6','SIRT7','KAT2A','KAT2B','EP300','CREBBP','EZH2','KDM5A','KDM1A','DNMT1','DNMT3A','DNMT3B','TET1','TET2','TET3','SMARCA4','ARID1A','CTCF','SUV39H1','SETDB1']);
const SIGNALING_SET = new Set(['NOTCH1','NOTCH2','HES1','HEY1','DLL1','JAG1','WNT3A','WNT5A','FZD1','FZD7','LRP5','LRP6','DKK1','RSPO1','SHH','GLI1','GLI2','PTCH1','SMO','MAPK1','MAPK3','AKT1','AKT2','PTEN','MTOR','RPTOR','EGFR','ERBB2','FGFR1','VEGFA','TGFB1','SMAD2','SMAD3','SMAD4','BMP2','BMP4']);
const DNA_REPAIR_SET = new Set(['BRCA1','BRCA2','RAD51','RAD50','XRCC1','XRCC4','ERCC1','ERCC2','MLH1','MSH2','MSH6','PMS2','XPC','DDB2','OGG1','APEX1','LIG1','LIG3','LIG4','PARP1','PARP2','POLB','POLK','REV3L','FANCD2','FANCA','H2AFX']);
const STEM_SET = new Set(['LGR5','ASCL2','SMOC2','OLFM4','BMI1','SOX2','SOX9','POU5F1','NANOG','KLF4','LIN28A','ALDH1A1','PROM1','CD44','LRIG1','HOPX','TERT','LY6A']);

const ALIAS_MAP: Record<string, string> = {
  'BMAL1': 'ARNTL', 'TRP53': 'TP53', 'HPRT1': 'HPRT',
  'SLC2A1': 'GLUT1', 'GLUT1': 'SLC2A1',
};

function classifyGeneFallback(name: string): { category: string; hierarchy: GeneAnnotation["hierarchy"] } | null {
  const upper = name.toUpperCase();
  const candidates = [upper];
  if (ALIAS_MAP[upper]) candidates.push(ALIAS_MAP[upper]);

  for (const c of candidates) {
    if (CLOCK_SET.has(c)) return { category: "Circadian Clock", hierarchy: "Tier 1 — Regulator" };
    if (TARGET_SET.has(c)) return { category: "Cell Cycle / Cancer", hierarchy: "Tier 2 — Effector" };
    if (HOUSEKEEPING_SET.has(c)) return { category: "Housekeeping", hierarchy: "Tier 3 — Baseline" };
    if (IMMUNE_SET.has(c)) return { category: "Immune", hierarchy: "Functional" };
    if (METABOLIC_SET.has(c)) return { category: "Metabolic", hierarchy: "Functional" };
    if (CHROMATIN_SET.has(c)) return { category: "Chromatin", hierarchy: "Functional" };
    if (SIGNALING_SET.has(c)) return { category: "Signaling", hierarchy: "Functional" };
    if (DNA_REPAIR_SET.has(c)) return { category: "DNA Repair", hierarchy: "Functional" };
    if (STEM_SET.has(c)) return { category: "Stem Cell", hierarchy: "Functional" };
  }
  return null;
}

export function getGeneAnnotation(geneName: string): GeneAnnotation | null {
  const normalized = geneName.replace(/['"]/g, '').trim();
  const direct = GENE_DB[normalized];
  if (direct) return direct;

  const upper = normalized.toUpperCase();
  for (const [key, val] of Object.entries(GENE_DB)) {
    if (key.toUpperCase() === upper) return val;
  }

  const fallback = classifyGeneFallback(normalized);
  if (fallback) {
    return {
      name: normalized,
      fullName: normalized,
      function: `Classified as ${fallback.category.toLowerCase()} gene`,
      role: fallback.category,
      category: fallback.category,
      hierarchy: fallback.hierarchy,
    };
  }

  return null;
}

export function getHierarchyInfo(hierarchy: GeneAnnotation["hierarchy"]): { color: string; description: string; icon: string } {
  switch (hierarchy) {
    case "Tier 1 — Regulator": return { color: "#f59e0b", description: "Highest persistence (|λ| ≈ 0.85–0.99). Master regulators driving circadian rhythms.", icon: "▲" };
    case "Tier 2 — Effector": return { color: "#ef4444", description: "Medium persistence (|λ| ≈ 0.60–0.85). Downstream targets receiving clock signals.", icon: "●" };
    case "Tier 3 — Baseline": return { color: "#6b7280", description: "Variable persistence. Constitutively expressed, not clock-controlled.", icon: "▽" };
    case "Functional": return { color: "#3b82f6", description: "Persistence varies by context. Specialized functional roles.", icon: "◆" };
  }
}

export function getCategoryColor(category: string): string {
  const colors: Record<string, string> = {
    "Circadian Clock": "#f59e0b",
    "Cell Cycle": "#ef4444",
    "Cell Cycle / Cancer": "#ef4444",
    "DNA Repair": "#14b8a6",
    "Metabolic": "#10b981",
    "Lipid Metabolism": "#06b6d4",
    "Drug Metabolism": "#ec4899",
    "Gluconeogenesis": "#f97316",
    "Epigenetic": "#a855f7",
    "Chromatin": "#ec4899",
    "Signaling": "#3b82f6",
    "Stem Cell": "#f97316",
    "Immune": "#8b5cf6",
    "Stress Response": "#ef4444",
    "Autophagy": "#84cc16",
    "Apoptosis": "#dc2626",
    "Housekeeping": "#6b7280",
    "Cancer": "#e11d48",
    "Growth Factor": "#6366f1",
    "Amino Acid": "#0ea5e9",
    "Oxidative Stress": "#eab308",
    "mTOR/Growth": "#3b82f6",
    "Mitochondrial": "#14b8a6",
    "UPR/Stress": "#ef4444",
    "Unclassified": "#475569",
  };
  return colors[category] || "#64748b";
}
