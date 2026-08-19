export const GO_BIOLOGICAL_PROCESS: Record<string, string[]> = {
  'Cell Cycle Regulation': [
    'CDK1', 'CDK2', 'CDK4', 'CDK6', 'CCNA2', 'CCNB1', 'CCNB2', 'CCND1', 'CCND2', 'CCND3',
    'CCNE1', 'CCNE2', 'CDKN1A', 'CDKN1B', 'CDKN2A', 'CDKN2B', 'RB1', 'E2F1', 'E2F2', 'E2F3',
    'CDC25A', 'CDC25B', 'CDC25C', 'PLK1', 'AURKA', 'AURKB', 'MYC', 'TP53', 'MDM2', 'SKP2',
    'WEE1', 'CHK1', 'CHK2', 'BUB1', 'BUB1B', 'MAD2L1',
  ],
  'DNA Replication': [
    'MCM2', 'MCM3', 'MCM4', 'MCM5', 'MCM6', 'MCM7', 'ORC1', 'ORC2', 'ORC3', 'ORC4',
    'ORC5', 'ORC6', 'CDC6', 'CDT1', 'PCNA', 'POLA1', 'POLD1', 'POLE', 'RFC1', 'RFC2',
    'RFC3', 'RFC4', 'RFC5', 'FEN1', 'LIG1', 'PRIM1', 'PRIM2', 'RPA1', 'RPA2', 'RPA3',
    'TOPBP1', 'GINS1', 'GINS2', 'GINS3', 'GINS4',
  ],
  'Mitosis': [
    'CDK1', 'CCNB1', 'CCNB2', 'PLK1', 'AURKA', 'AURKB', 'BUB1', 'BUB1B', 'BUB3',
    'MAD1L1', 'MAD2L1', 'CDC20', 'CDH1', 'CENPA', 'CENPB', 'CENPE', 'CENPF',
    'KIF11', 'KIF2C', 'KNSTRN', 'NDC80', 'NUF2', 'SPC24', 'SPC25', 'TTK',
    'NEK2', 'BIRC5', 'INCENP', 'TPX2', 'ESPL1', 'PTTG1', 'SGOL1',
  ],
  'DNA Repair - Base Excision': [
    'OGG1', 'UNG', 'SMUG1', 'MBD4', 'TDG', 'NTHL1', 'NEIL1', 'NEIL2', 'NEIL3',
    'MPG', 'MUTYH', 'APE1', 'APEX2', 'XRCC1', 'PARP1', 'PARP2', 'LIG3',
    'POLB', 'FEN1', 'PCNA',
  ],
  'DNA Repair - Nucleotide Excision': [
    'XPA', 'XPB', 'XPC', 'XPD', 'XPF', 'XPG', 'ERCC1', 'ERCC2', 'ERCC3',
    'ERCC4', 'ERCC5', 'ERCC6', 'ERCC8', 'DDB1', 'DDB2', 'RAD23A', 'RAD23B',
    'RPA1', 'RPA2', 'PCNA', 'LIG1', 'CETN2', 'GTF2H1', 'GTF2H2', 'GTF2H4',
  ],
  'DNA Repair - Mismatch': [
    'MLH1', 'MLH3', 'MSH2', 'MSH3', 'MSH6', 'PMS1', 'PMS2', 'EXO1', 'PCNA',
    'RFC1', 'RFC2', 'RFC3', 'RFC4', 'RFC5', 'LIG1', 'RPA1',
  ],
  'DNA Repair - Double Strand Break': [
    'BRCA1', 'BRCA2', 'RAD51', 'RAD51B', 'RAD51C', 'RAD51D', 'RAD52', 'RAD54L',
    'MRE11', 'RAD50', 'NBN', 'ATM', 'ATR', 'XRCC2', 'XRCC3', 'XRCC4', 'XRCC5',
    'XRCC6', 'LIG4', 'PRKDC', 'TP53BP1', 'RNF8', 'RNF168', 'PALB2', 'CHEK1', 'CHEK2',
    'H2AX', 'MDC1',
  ],
  'Apoptosis': [
    'BAX', 'BAK1', 'BCL2', 'BCL2L1', 'BCL2L11', 'MCL1', 'BID', 'BAD', 'BIK',
    'PMAIP1', 'BBC3', 'CASP3', 'CASP7', 'CASP8', 'CASP9', 'CASP10', 'APAF1',
    'CYCS', 'DIABLO', 'XIAP', 'BIRC2', 'BIRC3', 'BIRC5', 'FAS', 'FASLG',
    'TNFRSF10A', 'TNFRSF10B', 'TRADD', 'RIPK1', 'CFLAR', 'TP53', 'PARP1',
  ],
  'Circadian Rhythm': [
    'ARNTL', 'CLOCK', 'NPAS2', 'PER1', 'PER2', 'PER3', 'CRY1', 'CRY2',
    'NR1D1', 'NR1D2', 'RORA', 'RORB', 'RORC', 'DBP', 'TEF', 'HLF',
    'NFIL3', 'BHLHE40', 'BHLHE41', 'CSNK1D', 'CSNK1E', 'FBXL3', 'FBXW11',
    'SIRT1', 'NAMPT', 'CIART', 'NOCT',
  ],
  'MAPK Signaling': [
    'KRAS', 'HRAS', 'NRAS', 'BRAF', 'RAF1', 'ARAF', 'MAP2K1', 'MAP2K2',
    'MAPK1', 'MAPK3', 'MAP3K1', 'MAP3K5', 'MAP3K7', 'MAP2K4', 'MAP2K7',
    'MAPK8', 'MAPK9', 'MAPK10', 'MAPK14', 'MAP2K3', 'MAP2K6', 'SOS1',
    'GRB2', 'SHC1', 'DUSP1', 'DUSP6', 'SPRY2', 'EGFR', 'ERBB2',
  ],
  'Wnt Signaling': [
    'WNT1', 'WNT2', 'WNT3', 'WNT3A', 'WNT5A', 'WNT5B', 'WNT7A', 'WNT7B',
    'WNT10B', 'FZD1', 'FZD2', 'FZD7', 'LRP5', 'LRP6', 'DVL1', 'DVL2', 'DVL3',
    'CTNNB1', 'APC', 'AXIN1', 'AXIN2', 'GSK3B', 'CSNK1A1', 'TCF7', 'TCF7L1',
    'TCF7L2', 'LEF1', 'LGR5', 'RSPO1', 'RSPO3', 'RNF43', 'ZNRF3', 'DKK1',
    'SFRP1', 'MYC', 'CCND1',
  ],
  'Notch Signaling': [
    'NOTCH1', 'NOTCH2', 'NOTCH3', 'NOTCH4', 'DLL1', 'DLL3', 'DLL4',
    'JAG1', 'JAG2', 'RBPJ', 'MAML1', 'MAML2', 'MAML3', 'HES1', 'HES5',
    'HEY1', 'HEY2', 'HEYL', 'NUMB', 'NUMBL', 'ADAM10', 'ADAM17',
    'PSEN1', 'PSEN2', 'NCSTN', 'APH1A', 'LFNG', 'MFNG', 'RFNG',
  ],
  'Hedgehog Signaling': [
    'SHH', 'IHH', 'DHH', 'PTCH1', 'PTCH2', 'SMO', 'GLI1', 'GLI2', 'GLI3',
    'SUFU', 'STK36', 'KIF7', 'HHIP', 'GAS1', 'BOC', 'CDON', 'DISP1',
    'PRKACA', 'PRKACB', 'CSNK1G1',
  ],
  'TGF-beta Signaling': [
    'TGFB1', 'TGFB2', 'TGFB3', 'TGFBR1', 'TGFBR2', 'ACVR1', 'ACVR1B',
    'ACVR2A', 'ACVR2B', 'BMPR1A', 'BMPR1B', 'BMPR2', 'BMP2', 'BMP4', 'BMP7',
    'SMAD1', 'SMAD2', 'SMAD3', 'SMAD4', 'SMAD5', 'SMAD6', 'SMAD7', 'SMAD9',
    'SMURF1', 'SMURF2', 'INHBA', 'INHBB', 'NODAL', 'GDF11', 'LTBP1',
  ],
  'JAK-STAT Signaling': [
    'JAK1', 'JAK2', 'JAK3', 'TYK2', 'STAT1', 'STAT2', 'STAT3', 'STAT4',
    'STAT5A', 'STAT5B', 'STAT6', 'SOCS1', 'SOCS2', 'SOCS3', 'SOCS5',
    'CISH', 'PIAS1', 'PIAS2', 'PIAS3', 'PIAS4', 'PTPN1', 'PTPN2',
    'IL6ST', 'IFNAR1', 'IFNAR2', 'IFNGR1', 'IFNGR2',
  ],
  'PI3K-AKT Signaling': [
    'PIK3CA', 'PIK3CB', 'PIK3CD', 'PIK3R1', 'PIK3R2', 'AKT1', 'AKT2', 'AKT3',
    'PTEN', 'MTOR', 'RPTOR', 'RICTOR', 'TSC1', 'TSC2', 'RHEB', 'RPS6KB1',
    'EIF4EBP1', 'PDK1', 'GSK3A', 'GSK3B', 'FOXO1', 'FOXO3', 'BAD',
    'INSR', 'IGF1R', 'IRS1', 'IRS2',
  ],
  'NF-kB Signaling': [
    'NFKB1', 'NFKB2', 'RELA', 'RELB', 'REL', 'NFKBIA', 'NFKBIB', 'NFKBIE',
    'IKBKA', 'IKBKB', 'IKBKG', 'TRAF2', 'TRAF3', 'TRAF6', 'IRAK1', 'IRAK4',
    'MYD88', 'TNFAIP3', 'TNF', 'TNFRSF1A', 'IL1B', 'IL1R1', 'RIPK1',
    'TAB1', 'TAB2', 'MAP3K7', 'BCL3',
  ],
  'Transcription Regulation': [
    'TBP', 'TAF1', 'GTF2B', 'GTF2F1', 'GTF2H1', 'POLR2A', 'POLR2B',
    'MED1', 'MED12', 'MED14', 'MED15', 'MED23', 'CDK7', 'CDK8', 'CDK9',
    'SP1', 'SP3', 'YY1', 'CTCF', 'CEBPA', 'CEBPB', 'JUN', 'FOS',
    'ATF2', 'ATF4', 'CREB1', 'ELK1', 'SRF', 'ETS1', 'GATA1',
  ],
  'Chromatin Remodeling': [
    'SMARCA4', 'SMARCA2', 'SMARCB1', 'SMARCC1', 'SMARCC2', 'SMARCD1',
    'ARID1A', 'ARID1B', 'ARID2', 'CHD1', 'CHD3', 'CHD4', 'CHD7',
    'EP300', 'CREBBP', 'KAT2A', 'KAT2B', 'HDAC1', 'HDAC2', 'HDAC3',
    'HDAC4', 'HDAC6', 'SIRT1', 'SIRT2', 'SIRT6', 'BRD4', 'BRD2',
    'INO80', 'SRCAP', 'RUVBL1', 'RUVBL2',
  ],
  'Cell Adhesion': [
    'CDH1', 'CDH2', 'CDH3', 'CDH5', 'CTNNB1', 'CTNNA1', 'CTNNB1',
    'ITGA1', 'ITGA2', 'ITGA3', 'ITGA5', 'ITGA6', 'ITGAV', 'ITGB1',
    'ITGB3', 'ITGB4', 'ITGB5', 'ICAM1', 'VCAM1', 'PECAM1', 'SELE',
    'SELP', 'CD44', 'EPCAM', 'CLDN1', 'CLDN3', 'CLDN4', 'OCLN',
    'TJP1', 'TJP2', 'DSP', 'JUP',
  ],
  'Innate Immune Response': [
    'TLR1', 'TLR2', 'TLR3', 'TLR4', 'TLR5', 'TLR7', 'TLR8', 'TLR9',
    'MYD88', 'TICAM1', 'IRAK1', 'IRAK4', 'TRAF6', 'IRF3', 'IRF7',
    'IFNB1', 'CGAS', 'STING1', 'MAVS', 'RIG1', 'MDA5',
    'NLRP3', 'CASP1', 'IL1B', 'IL18', 'PYCARD', 'TNF', 'IL6',
    'CXCL8', 'CCL2', 'NFE2L2',
  ],
  'Adaptive Immune Response': [
    'CD3D', 'CD3E', 'CD3G', 'CD4', 'CD8A', 'CD8B', 'ZAP70', 'LCK',
    'LAT', 'PLCG1', 'ITK', 'NFATC1', 'NFATC2', 'CD28', 'CTLA4',
    'PDCD1', 'CD274', 'ICOS', 'CD19', 'CD79A', 'CD79B', 'BTK',
    'BLNK', 'SYK', 'PRKCB', 'BCL6', 'PRDM1', 'FOXP3', 'IL2',
    'IL2RA', 'GATA3', 'TBX21', 'RORC',
  ],
  'Glycolysis': [
    'HK1', 'HK2', 'GPI', 'PFKM', 'PFKL', 'PFKP', 'ALDOA', 'ALDOB',
    'TPI1', 'GAPDH', 'PGK1', 'PGAM1', 'ENO1', 'ENO2', 'PKM', 'PKLR',
    'LDHA', 'LDHB', 'SLC2A1', 'SLC2A4', 'PDK1', 'PDK2', 'PDHA1', 'GCK',
  ],
  'TCA Cycle': [
    'CS', 'ACO1', 'ACO2', 'IDH1', 'IDH2', 'IDH3A', 'IDH3B', 'IDH3G',
    'OGDH', 'DLST', 'DLD', 'SUCLG1', 'SUCLG2', 'SUCLA2', 'SDHA', 'SDHB',
    'SDHC', 'SDHD', 'FH', 'MDH1', 'MDH2', 'PC', 'PCK1', 'PCK2',
  ],
  'Fatty Acid Metabolism': [
    'FASN', 'ACACA', 'ACACB', 'ACLY', 'SCD', 'FADS1', 'FADS2', 'ELOVL1',
    'ELOVL5', 'ELOVL6', 'CPT1A', 'CPT1B', 'CPT2', 'ACADM', 'ACADL',
    'ACADVL', 'HADHA', 'HADHB', 'ACOX1', 'PPARA', 'PPARG', 'PPARGC1A',
    'SREBF1', 'SREBF2',
  ],
  'Amino Acid Metabolism': [
    'GOT1', 'GOT2', 'GPT', 'GPT2', 'GLUD1', 'GLS', 'GLS2', 'ASNS',
    'ASS1', 'ASL', 'OTC', 'CPS1', 'ARG1', 'ARG2', 'NOS1', 'NOS2',
    'NOS3', 'CBS', 'CTH', 'PAH', 'TH', 'DDC', 'TPH1', 'IDO1',
  ],
  'Lipid Metabolism': [
    'HMGCR', 'HMGCS1', 'HMGCS2', 'MVK', 'MVD', 'FDPS', 'FDFT1', 'SQLE',
    'CYP51A1', 'DHCR7', 'DHCR24', 'LDLR', 'PCSK9', 'ABCA1', 'ABCG1',
    'NR1H3', 'NR1H2', 'SREBF1', 'SREBF2', 'SCAP', 'INSIG1', 'INSIG2',
    'LIPA', 'LIPC', 'LIPG', 'DGAT1', 'DGAT2',
  ],
  'Stem Cell Maintenance': [
    'POU5F1', 'SOX2', 'NANOG', 'KLF4', 'MYC', 'LIN28A', 'LIN28B',
    'PRDM14', 'TFCP2L1', 'ESRRB', 'TBX3', 'DPPA3', 'DPPA4', 'DPPA5',
    'SALL4', 'UTF1', 'ZFP42', 'TERT', 'LGR5', 'BMI1', 'ALDH1A1',
    'CD44', 'CD133', 'EPCAM', 'WNT3A', 'LIF', 'STAT3',
  ],
  'Cellular Differentiation': [
    'MYOD1', 'MYOG', 'MEF2C', 'PAX7', 'RUNX2', 'SP7', 'SOX9',
    'PPARG', 'CEBPA', 'CEBPB', 'GATA1', 'GATA2', 'GATA3', 'GATA4',
    'GATA6', 'SPI1', 'KLF1', 'PAX6', 'NEUROD1', 'NEUROG1', 'NEUROG2',
    'ASCL1', 'OLIG2', 'TBX5', 'NKX2-5', 'ISL1', 'HAND2',
  ],
  'Autophagy': [
    'ATG3', 'ATG4B', 'ATG5', 'ATG7', 'ATG9A', 'ATG10', 'ATG12', 'ATG13',
    'ATG14', 'ATG16L1', 'BECN1', 'MAP1LC3A', 'MAP1LC3B', 'GABARAP',
    'GABARAPL1', 'GABARAPL2', 'ULK1', 'ULK2', 'PIK3C3', 'PIK3R4',
    'SQSTM1', 'NBR1', 'OPTN', 'LAMP1', 'LAMP2', 'TFEB', 'MTOR',
    'AMBRA1', 'WIPI1', 'WIPI2', 'VPS34',
  ],
  'Protein Folding': [
    'HSPA1A', 'HSPA1B', 'HSPA5', 'HSPA8', 'HSP90AA1', 'HSP90AB1',
    'HSP90B1', 'HSPD1', 'HSPE1', 'HSPB1', 'DNAJB1', 'DNAJC10',
    'CCT2', 'CCT3', 'CCT4', 'CCT5', 'CCT6A', 'CCT7', 'CCT8', 'TCP1',
    'CALR', 'CANX', 'PDIA3', 'PDIA4', 'PPIB', 'FKBP4', 'BAG1', 'BAG3',
    'STUB1', 'HSF1',
  ],
  'mRNA Splicing': [
    'SRSF1', 'SRSF2', 'SRSF3', 'SRSF5', 'SRSF6', 'SRSF7', 'HNRNPA1',
    'HNRNPA2B1', 'HNRNPC', 'HNRNPD', 'HNRNPK', 'HNRNPL', 'HNRNPU',
    'U2AF1', 'U2AF2', 'SF3B1', 'SF3B3', 'PRPF8', 'PRPF19', 'PRPF31',
    'SNRNP200', 'SNRPD1', 'SNRPD2', 'SNRPD3', 'SNRPE', 'SNRPF',
    'RBFOX2', 'MBNL1', 'PTBP1', 'TRA2B',
  ],
  'Translation': [
    'EIF4A1', 'EIF4E', 'EIF4G1', 'EIF2S1', 'EIF2S2', 'EIF2S3', 'EIF3A',
    'EIF3B', 'EIF3C', 'EIF5', 'EIF5B', 'EIF1', 'EEF1A1', 'EEF2',
    'ETF1', 'GSPT1', 'EIF2AK1', 'EIF2AK2', 'EIF2AK3', 'EIF2AK4',
    'RPS6', 'RPS6KB1', 'MTOR', 'EIF4EBP1', 'PABPC1',
  ],
  'Ribosome Biogenesis': [
    'RPS2', 'RPS3', 'RPS5', 'RPS6', 'RPS8', 'RPS14', 'RPS19', 'RPS24',
    'RPL5', 'RPL11', 'RPL23', 'RPL26', 'RPL35A', 'RPL4', 'RPL7',
    'BOP1', 'PES1', 'WDR12', 'NOP56', 'NOP58', 'FBL', 'DKC1', 'NHP2',
    'GAR1', 'NCL', 'NPM1', 'UTP6', 'UTP14A', 'POLR1A', 'POLR1B',
  ],
  'Cytoskeleton Organization': [
    'ACTB', 'ACTG1', 'ACTA2', 'TUBA1A', 'TUBA1B', 'TUBB', 'TUBB3',
    'VIM', 'DES', 'KRT8', 'KRT18', 'KRT19', 'LMNA', 'LMNB1',
    'CDC42', 'RAC1', 'RHOA', 'ROCK1', 'ROCK2', 'LIMK1', 'CFL1',
    'PFN1', 'ARPC2', 'WASL', 'WAVE2', 'DIAPH1', 'MYH9', 'MYH10',
    'MYO1C', 'EZR', 'MSN', 'RDX',
  ],
  'Ion Transport': [
    'KCNJ11', 'KCNMA1', 'KCNQ1', 'KCNH2', 'SCN1A', 'SCN2A', 'SCN5A',
    'SCN9A', 'CACNA1A', 'CACNA1C', 'CACNA1D', 'CACNA1S', 'CLCN1',
    'CLCN2', 'CFTR', 'SLC12A1', 'SLC12A2', 'SLC9A1', 'ATP1A1',
    'ATP1A2', 'ATP1B1', 'ATP2A1', 'ATP2A2', 'ATP2B1', 'SLC8A1',
    'TRPV1', 'TRPC1', 'TRPM7', 'PIEZO1', 'PIEZO2',
  ],
  'Angiogenesis': [
    'VEGFA', 'VEGFB', 'VEGFC', 'KDR', 'FLT1', 'FLT4', 'NRP1', 'NRP2',
    'ANGPT1', 'ANGPT2', 'TEK', 'TIE1', 'HIF1A', 'EPAS1', 'DLL4',
    'ENG', 'PECAM1', 'CDH5', 'FGF2', 'FGFR1', 'PDGFB', 'PDGFRB',
    'NOTCH1', 'EFNB2', 'EPHB4', 'THBS1', 'THBS2', 'SEMA3A',
  ],
  'Hippo Signaling': [
    'MST1', 'MST2', 'SAV1', 'LATS1', 'LATS2', 'MOB1A', 'MOB1B',
    'YAP1', 'WWTR1', 'TEAD1', 'TEAD2', 'TEAD3', 'TEAD4', 'NF2',
    'WWC1', 'AMOT', 'AMOTL1', 'AMOTL2', 'VGLL4', 'CRB3', 'SCRIB',
    'DLG1', 'LLGL1', 'FAT4', 'DCHS1', 'FRMD6',
  ],
  'p53 Signaling': [
    'TP53', 'MDM2', 'MDM4', 'CDKN1A', 'CDKN2A', 'BAX', 'BBC3', 'PMAIP1',
    'GADD45A', 'GADD45B', 'GADD45G', 'ATM', 'ATR', 'CHEK1', 'CHEK2',
    'TP53BP1', 'TP53I3', 'PERP', 'SESN1', 'SESN2', 'TIGAR', 'DRAM1',
    'RRM2B', 'DDB2', 'XPC', 'PIDD1', 'SIAH1', 'HIPK2', 'USP7',
  ],
  'Oxidative Stress Response': [
    'NFE2L2', 'KEAP1', 'HMOX1', 'NQO1', 'GCLC', 'GCLM', 'GSR', 'GPX1',
    'GPX4', 'SOD1', 'SOD2', 'SOD3', 'CAT', 'PRDX1', 'PRDX2', 'PRDX3',
    'PRDX4', 'PRDX5', 'PRDX6', 'TXN', 'TXNRD1', 'SRXN1', 'SQSTM1',
    'PARK7', 'FTH1', 'FTL', 'SLC7A11', 'MAFG',
  ],
  'DNA Methylation': [
    'DNMT1', 'DNMT3A', 'DNMT3B', 'DNMT3L', 'TET1', 'TET2', 'TET3',
    'MBD1', 'MBD2', 'MBD3', 'MBD4', 'MECP2', 'UHRF1', 'UHRF2',
    'AICDA', 'APOBEC1', 'TDG', 'GADD45A', 'IDH1', 'IDH2',
  ],
  'Histone Modification': [
    'KMT2A', 'KMT2B', 'KMT2C', 'KMT2D', 'SETD2', 'NSD1', 'NSD2',
    'EZH2', 'EZH1', 'SUZ12', 'EED', 'BMI1', 'RING1', 'RNF2',
    'KDM1A', 'KDM5A', 'KDM5B', 'KDM6A', 'KDM6B', 'JMJD3',
    'KAT2A', 'KAT2B', 'EP300', 'CREBBP', 'HDAC1', 'HDAC2', 'HDAC3',
    'SIRT1', 'SIRT6', 'DOT1L', 'SETDB1', 'PRMT1', 'PRMT5',
  ],
  'Senescence': [
    'CDKN1A', 'CDKN2A', 'CDKN2B', 'TP53', 'RB1', 'E2F1', 'LMNB1',
    'HMGA1', 'HMGA2', 'IL6', 'IL8', 'CXCL1', 'CCL2', 'MMP1', 'MMP3',
    'SERPINE1', 'IGFBP3', 'IGFBP7', 'TGFB1', 'BMP2', 'H2AX', 'ATM',
    'MDM2', 'SIRT1',
  ],
  'Ubiquitin-Proteasome': [
    'UBA1', 'UBE2D1', 'UBE2D3', 'UBE2N', 'UBE2K', 'UBB', 'UBC',
    'PSMA1', 'PSMA2', 'PSMA3', 'PSMA4', 'PSMA5', 'PSMA6', 'PSMA7',
    'PSMB1', 'PSMB2', 'PSMB5', 'PSMB8', 'PSMB9', 'PSMB10',
    'PSMC1', 'PSMC2', 'PSMC3', 'PSMD1', 'PSMD2', 'USP7', 'USP14',
    'RNF8', 'MDM2', 'SKP2', 'FBXW7', 'VHL',
  ],
  'Unfolded Protein Response': [
    'ERN1', 'EIF2AK3', 'ATF6', 'XBP1', 'ATF4', 'DDIT3', 'HSPA5',
    'CALR', 'CANX', 'PDIA3', 'PDIA4', 'EDEM1', 'DERL1', 'DERL2',
    'SEL1L', 'HRD1', 'OS9', 'DNAJB9', 'HERPUD1', 'GADD34',
    'TRIB3', 'BBC3',
  ],
  'Telomere Maintenance': [
    'TERT', 'TERC', 'DKC1', 'NHP2', 'NOP10', 'GAR1', 'WRAP53',
    'POT1', 'TRF1', 'TRF2', 'TIN2', 'TPP1', 'RAP1',
    'RTEL1', 'CTC1', 'STN1', 'TEN1', 'CST3',
  ],
  'Vesicular Transport': [
    'RAB5A', 'RAB7A', 'RAB11A', 'RAB27A', 'RAB3A', 'NSF', 'SNAP25',
    'STX1A', 'VAMP2', 'SYP', 'CLTC', 'AP2A1', 'AP2B1', 'DNM2',
    'EEA1', 'RAB9A', 'VPS35', 'VPS26A', 'VPS29', 'SNX1', 'SNX2',
    'SEC61A1', 'SEC23A', 'SEC24C', 'COPA', 'COPB1', 'ARF1',
  ],
};

export const KEGG_PATHWAYS: Record<string, string[]> = {
  'hsa04110: Cell Cycle': [
    'CDK1', 'CDK2', 'CDK4', 'CDK6', 'CCNA2', 'CCNB1', 'CCND1', 'CCNE1',
    'RB1', 'E2F1', 'E2F2', 'TP53', 'CDKN1A', 'CDKN1B', 'CDKN2A',
    'CDC25A', 'CDC25B', 'CDC25C', 'PLK1', 'BUB1', 'MAD2L1', 'CDC20',
    'WEE1', 'SKP2', 'MDM2', 'ATM', 'ATR', 'CHEK1', 'CHEK2', 'MCM2',
  ],
  'hsa04210: Apoptosis': [
    'BAX', 'BAK1', 'BCL2', 'BCL2L1', 'BID', 'BAD', 'BBC3', 'PMAIP1',
    'CASP3', 'CASP7', 'CASP8', 'CASP9', 'APAF1', 'CYCS', 'XIAP',
    'FAS', 'FASLG', 'TNF', 'TNFRSF1A', 'TRADD', 'RIPK1', 'CFLAR',
    'DIABLO', 'TP53', 'AKT1', 'BIRC2', 'BIRC3',
  ],
  'hsa04310: Wnt Signaling': [
    'WNT1', 'WNT3A', 'WNT5A', 'FZD1', 'FZD7', 'LRP5', 'LRP6',
    'DVL1', 'DVL2', 'CTNNB1', 'APC', 'AXIN1', 'AXIN2', 'GSK3B',
    'TCF7L2', 'LEF1', 'MYC', 'CCND1', 'SFRP1', 'DKK1', 'LGR5',
    'RNF43', 'ZNRF3', 'RSPO1', 'CSNK1A1',
  ],
  'hsa04330: Notch Signaling': [
    'NOTCH1', 'NOTCH2', 'NOTCH3', 'NOTCH4', 'DLL1', 'DLL4', 'JAG1',
    'JAG2', 'RBPJ', 'MAML1', 'HES1', 'HES5', 'HEY1', 'HEY2',
    'NUMB', 'ADAM10', 'ADAM17', 'PSEN1', 'PSEN2', 'NCSTN',
  ],
  'hsa04340: Hedgehog Signaling': [
    'SHH', 'IHH', 'DHH', 'PTCH1', 'SMO', 'GLI1', 'GLI2', 'GLI3',
    'SUFU', 'STK36', 'KIF7', 'HHIP', 'GAS1', 'BOC', 'CDON', 'PRKACA',
  ],
  'hsa04350: TGF-beta Signaling': [
    'TGFB1', 'TGFB2', 'TGFB3', 'TGFBR1', 'TGFBR2', 'SMAD2', 'SMAD3',
    'SMAD4', 'SMAD6', 'SMAD7', 'BMP2', 'BMP4', 'BMP7', 'BMPR1A',
    'BMPR2', 'ACVR1', 'INHBA', 'NODAL', 'SMURF1', 'SMURF2',
  ],
  'hsa04630: JAK-STAT Signaling': [
    'JAK1', 'JAK2', 'JAK3', 'TYK2', 'STAT1', 'STAT2', 'STAT3',
    'STAT5A', 'STAT5B', 'STAT6', 'SOCS1', 'SOCS3', 'CISH',
    'IL6', 'IL6ST', 'IFNAR1', 'IFNGR1', 'PIAS1', 'PIAS3',
  ],
  'hsa04010: MAPK Signaling': [
    'KRAS', 'HRAS', 'NRAS', 'BRAF', 'RAF1', 'MAP2K1', 'MAP2K2',
    'MAPK1', 'MAPK3', 'MAPK8', 'MAPK9', 'MAPK14', 'MAP3K1',
    'MAP3K7', 'SOS1', 'GRB2', 'EGFR', 'ERBB2', 'DUSP1', 'DUSP6',
    'MAP2K4', 'MAP2K7', 'MAP3K5',
  ],
  'hsa04151: PI3K-AKT Signaling': [
    'PIK3CA', 'PIK3CB', 'PIK3R1', 'AKT1', 'AKT2', 'PTEN', 'MTOR',
    'TSC1', 'TSC2', 'RHEB', 'RPS6KB1', 'EIF4EBP1', 'PDK1',
    'GSK3B', 'FOXO1', 'FOXO3', 'INSR', 'IGF1R', 'IRS1',
  ],
  'hsa04064: NF-kB Signaling': [
    'NFKB1', 'NFKB2', 'RELA', 'RELB', 'NFKBIA', 'IKBKB', 'IKBKG',
    'TRAF2', 'TRAF6', 'IRAK1', 'IRAK4', 'MYD88', 'TNFAIP3',
    'TNF', 'IL1B', 'RIPK1', 'TAB1', 'MAP3K7',
  ],
  'hsa04710: Circadian Rhythm': [
    'ARNTL', 'CLOCK', 'NPAS2', 'PER1', 'PER2', 'PER3', 'CRY1', 'CRY2',
    'NR1D1', 'NR1D2', 'RORA', 'RORC', 'DBP', 'TEF', 'HLF',
    'CSNK1D', 'CSNK1E', 'FBXL3',
  ],
  'hsa04140: Autophagy': [
    'ATG3', 'ATG5', 'ATG7', 'ATG12', 'ATG13', 'ATG14', 'ATG16L1',
    'BECN1', 'MAP1LC3B', 'ULK1', 'ULK2', 'PIK3C3', 'SQSTM1',
    'LAMP2', 'TFEB', 'MTOR', 'AMBRA1', 'WIPI2',
  ],
  'hsa04390: Hippo Signaling': [
    'MST1', 'MST2', 'SAV1', 'LATS1', 'LATS2', 'MOB1A', 'YAP1',
    'WWTR1', 'TEAD1', 'TEAD4', 'NF2', 'AMOT', 'FAT4', 'DCHS1',
    'VGLL4', 'SCRIB', 'FRMD6',
  ],
  'hsa04115: p53 Signaling': [
    'TP53', 'MDM2', 'MDM4', 'CDKN1A', 'BAX', 'BBC3', 'PMAIP1',
    'GADD45A', 'GADD45B', 'ATM', 'ATR', 'CHEK1', 'CHEK2',
    'SESN1', 'SESN2', 'TIGAR', 'DDB2', 'RRM2B', 'PERP',
  ],
  'hsa00010: Glycolysis/Gluconeogenesis': [
    'HK1', 'HK2', 'GPI', 'PFKM', 'ALDOA', 'TPI1', 'GAPDH',
    'PGK1', 'PGAM1', 'ENO1', 'PKM', 'LDHA', 'LDHB', 'PKLR',
    'GCK', 'PCK1', 'PCK2', 'PDHA1', 'G6PC',
  ],
  'hsa00020: TCA Cycle': [
    'CS', 'ACO2', 'IDH2', 'IDH3A', 'IDH3B', 'OGDH', 'DLST', 'DLD',
    'SUCLG1', 'SUCLA2', 'SDHA', 'SDHB', 'SDHC', 'SDHD', 'FH',
    'MDH2', 'PC',
  ],
  'hsa00190: Oxidative Phosphorylation': [
    'NDUFS1', 'NDUFS2', 'NDUFS3', 'NDUFV1', 'NDUFV2', 'NDUFA9',
    'SDHA', 'SDHB', 'UQCRC1', 'UQCRC2', 'UQCRFS1', 'CYC1',
    'COX4I1', 'COX5A', 'COX5B', 'COX6C', 'COX7A2',
    'ATP5F1A', 'ATP5F1B', 'ATP5F1C', 'ATP5PO',
  ],
  'hsa04620: Toll-like Receptor Signaling': [
    'TLR1', 'TLR2', 'TLR3', 'TLR4', 'TLR5', 'TLR7', 'TLR9',
    'MYD88', 'TICAM1', 'IRAK1', 'IRAK4', 'TRAF6', 'IRF3',
    'IRF7', 'NFKB1', 'RELA', 'MAPK8', 'MAPK14', 'IL6', 'TNF',
  ],
  'hsa04660: T Cell Receptor Signaling': [
    'CD3D', 'CD3E', 'CD3G', 'CD4', 'CD8A', 'ZAP70', 'LCK',
    'LAT', 'PLCG1', 'ITK', 'NFATC1', 'NFATC2', 'CD28', 'CTLA4',
    'PDCD1', 'ICOS', 'GRB2', 'SOS1', 'MAPK1', 'AKT1',
  ],
  'hsa04510: Focal Adhesion': [
    'ITGA1', 'ITGA5', 'ITGAV', 'ITGB1', 'ITGB3', 'ILK', 'PTK2',
    'PXN', 'VCL', 'TLN1', 'FN1', 'COL1A1', 'LAMC1', 'SRC',
    'BCAR1', 'CRK', 'RAC1', 'RHOA', 'ROCK1', 'MAPK1', 'AKT1',
  ],
  'hsa04520: Adherens Junction': [
    'CDH1', 'CDH2', 'CTNNB1', 'CTNNA1', 'CTNND1', 'VCL', 'AFDN',
    'NECTIN1', 'NECTIN2', 'NECTIN3', 'PVRL4', 'IQGAP1', 'RAC1',
    'CDC42', 'RHOA', 'ACTN1', 'FYN', 'SRC', 'SNAI1', 'SNAI2',
  ],
  'hsa04910: Insulin Signaling': [
    'INSR', 'IRS1', 'IRS2', 'PIK3CA', 'PIK3R1', 'AKT1', 'AKT2',
    'GSK3B', 'GYS1', 'SLC2A4', 'FOXO1', 'MTOR', 'RPS6KB1',
    'SOS1', 'GRB2', 'MAPK1', 'MAPK3', 'PCK1', 'G6PC', 'SREBF1',
  ],
  'hsa05200: Pathways in Cancer': [
    'TP53', 'RB1', 'APC', 'PTEN', 'KRAS', 'BRAF', 'MYC', 'EGFR',
    'ERBB2', 'PIK3CA', 'AKT1', 'MTOR', 'MDM2', 'BCL2', 'BAX',
    'VEGFA', 'FGF2', 'CTNNB1', 'CDKN2A', 'SMAD4', 'BRCA1', 'BRCA2',
    'VHL', 'CDH1', 'NOTCH1', 'WNT1', 'SHH', 'TGFB1', 'JAK2', 'STAT3',
  ],
  'hsa04152: AMPK Signaling': [
    'PRKAA1', 'PRKAA2', 'PRKAB1', 'PRKAG1', 'STK11', 'CAMKK2',
    'MTOR', 'RPTOR', 'TSC2', 'SREBF1', 'ACACA', 'HMGCR',
    'FOXO3', 'ULK1', 'PFKFB3', 'SLC2A4', 'PPARGC1A',
  ],
  'hsa03030: DNA Replication': [
    'MCM2', 'MCM3', 'MCM4', 'MCM5', 'MCM6', 'MCM7', 'PCNA',
    'POLA1', 'POLD1', 'POLE', 'RFC1', 'RFC2', 'RFC3', 'RFC4',
    'RFC5', 'FEN1', 'LIG1', 'PRIM1', 'RPA1', 'RPA2',
  ],
  'hsa03410: Base Excision Repair': [
    'OGG1', 'UNG', 'SMUG1', 'TDG', 'NTHL1', 'NEIL1', 'MPG',
    'MUTYH', 'APE1', 'XRCC1', 'PARP1', 'POLB', 'LIG3', 'FEN1',
    'PCNA',
  ],
};

export const DYNAMICAL_PREDICTIONS: Record<string, string[]> = {
  positive_feedback: [
    'MYC', 'KRAS', 'HRAS', 'NRAS', 'BRAF', 'PIK3CA', 'AKT1', 'MTOR',
    'EGFR', 'ERBB2', 'PDGFRA', 'PDGFRB', 'FGFR1', 'FGFR2', 'FGF2',
    'VEGFA', 'WNT3A', 'CTNNB1', 'CCND1', 'JUN', 'FOS', 'ETS1',
    'SRC', 'ABL1', 'BCR', 'JAK2', 'STAT3', 'STAT5A', 'STAT5B',
    'NFKB1', 'RELA', 'EZH2', 'BMI1', 'LGR5', 'RSPO1',
    'IGF1', 'IGF1R', 'IRS1', 'YAP1', 'WWTR1', 'TERT',
    'LIN28A', 'SOX2', 'POU5F1', 'NANOG', 'IL6',
    'MAPK1', 'MAPK3', 'SOS1', 'GRB2',
  ],
  toggle_switch: [
    'TP53', 'RB1', 'CDKN2A', 'CDKN1A', 'PTEN', 'APC', 'VHL',
    'BRCA1', 'BRCA2', 'SMAD4', 'NF2', 'WT1', 'NF1', 'TSC1', 'TSC2',
    'CDH1', 'FBXW7', 'BAX', 'BCL2', 'MCL1',
    'GATA1', 'GATA2', 'SPI1', 'CEBPA', 'PAX5', 'EBF1',
    'MYOD1', 'PAX7', 'NANOG', 'GATA6',
    'SOX2', 'SOX9', 'RUNX2', 'PPARG',
    'FOXO1', 'FOXO3', 'LATS1', 'LATS2',
    'NOTCH1', 'DLL1', 'NUMB',
    'SNAI1', 'SNAI2', 'ZEB1', 'ZEB2', 'CDH1', 'CDH2',
  ],
  oscillatory: [
    'ARNTL', 'CLOCK', 'NPAS2', 'PER1', 'PER2', 'PER3',
    'CRY1', 'CRY2', 'NR1D1', 'NR1D2', 'DBP', 'TEF', 'HLF',
    'RORA', 'RORB', 'RORC', 'NFIL3', 'BHLHE40', 'BHLHE41',
    'CSNK1D', 'CSNK1E', 'FBXL3', 'CIART',
    'HES1', 'HES5', 'HES7', 'HEY1', 'HEY2',
    'LFNG', 'DLL1', 'DLL3', 'NOTCH1', 'MESP2',
    'TP53', 'MDM2',
    'NFKB1', 'NFKBIA',
    'WEE1', 'CDK1', 'CCNB1', 'PLK1', 'CDC25C', 'AURKA',
    'CDKN1A', 'GADD45A',
    'NFE2L2', 'KEAP1',
    'NOCT', 'NAMPT',
  ],
  memoryless: [
    'FOS', 'JUN', 'JUNB', 'JUND', 'FOSB', 'FOSL1', 'FOSL2',
    'EGR1', 'EGR2', 'EGR3', 'EGR4',
    'NR4A1', 'NR4A2', 'NR4A3',
    'ATF3', 'DUSP1', 'DUSP2', 'DUSP5',
    'ZFP36', 'IER2', 'IER3', 'IER5',
    'BTG2', 'PLK2', 'PLK3',
    'GADD45B', 'GADD45G',
    'ARC', 'NPAS4', 'BDNF',
    'IL1B', 'TNF', 'CXCL1', 'CXCL2', 'CCL2', 'CCL4',
    'HSPA1A', 'HSPA1B', 'DNAJB1',
    'MYC', 'RHOB', 'SGK1', 'KLF2', 'KLF4',
  ],
};

export function speciesGeneMap(species: 'mouse' | 'human', gene: string): string {
  if (species === 'human') {
    return gene.toUpperCase();
  }
  if (!gene || gene.length === 0) return gene;
  const upper = gene.toUpperCase();
  const specialCases: Record<string, string> = {
    'NR1D1': 'Nr1d1',
    'NR1D2': 'Nr1d2',
    'NR1H3': 'Nr1h3',
    'NR1H2': 'Nr1h2',
    'NR4A1': 'Nr4a1',
    'NR4A2': 'Nr4a2',
    'NR4A3': 'Nr4a3',
    'NKX2-5': 'Nkx2-5',
    'MAP1LC3A': 'Map1lc3a',
    'MAP1LC3B': 'Map1lc3b',
    'POU5F1': 'Pou5f1',
    'NFE2L2': 'Nfe2l2',
    'SLC2A1': 'Slc2a1',
    'SLC2A4': 'Slc2a4',
    'SLC7A11': 'Slc7a11',
    'SLC8A1': 'Slc8a1',
    'SLC9A1': 'Slc9a1',
    'SLC12A1': 'Slc12a1',
    'SLC12A2': 'Slc12a2',
    'EIF2AK1': 'Eif2ak1',
    'EIF2AK2': 'Eif2ak2',
    'EIF2AK3': 'Eif2ak3',
    'EIF2AK4': 'Eif2ak4',
    'EIF4EBP1': 'Eif4ebp1',
    'TNFRSF1A': 'Tnfrsf1a',
    'TNFRSF10A': 'Tnfrsf10a',
    'TNFRSF10B': 'Tnfrsf10b',
    'BCL2L1': 'Bcl2l1',
    'BCL2L11': 'Bcl2l11',
    'CDKN1A': 'Cdkn1a',
    'CDKN1B': 'Cdkn1b',
    'CDKN2A': 'Cdkn2a',
    'CDKN2B': 'Cdkn2b',
    'TP53BP1': 'Trp53bp1',
    'TP53': 'Trp53',
    'TP53I3': 'Trp53i3',
    'IL1B': 'Il1b',
    'IL1R1': 'Il1r1',
    'IL2': 'Il2',
    'IL2RA': 'Il2ra',
    'IL6': 'Il6',
    'IL6ST': 'Il6st',
    'IL8': 'Cxcl15',
    'IL18': 'Il18',
    'CXCL8': 'Cxcl15',
    'CD133': 'Prom1',
    'ARNTL': 'Arntl',
  };
  if (specialCases[upper]) {
    return specialCases[upper];
  }
  return upper.charAt(0) + upper.slice(1).toLowerCase();
}

export function resolveToHuman(gene: string): string {
  if (!gene || gene.length === 0) return gene;
  const upper = gene.toUpperCase();
  const mouseToHuman: Record<string, string> = {
    'TRP53': 'TP53',
    'TRP53BP1': 'TP53BP1',
    'TRP53I3': 'TP53I3',
    'PROM1': 'CD133',
    'CXCL15': 'CXCL8',
  };
  if (mouseToHuman[upper]) {
    return mouseToHuman[upper];
  }
  return upper;
}
