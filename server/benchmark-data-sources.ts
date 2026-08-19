export function generateBenchmarkDataSourcesMd(rdv: any): string {
  return `# External Benchmark Data Source Classification
## PAR(2) Discovery Engine — Benchmark Transparency Report
Generated: ${new Date().toISOString()}

## Summary

Each external benchmark in the PAR(2) framework uses a different level of empirical grounding.
This document classifies each benchmark by its data source to ensure transparent interpretation.

| Benchmark | Data Source | Classification | Notes |
|-----------|-----------|----------------|-------|
| Turing Symmetry-Breaking | Schnakenberg reaction-diffusion simulation | Simulation Only | Parameters tuned to produce φ bifurcation; not independent evidence |
| Fisher Information Throughput | Transfer function mathematical model | Theoretical Model | Shows optimal information transmission at intermediate eigenvalues |
| STRING Network | STRING v12.0 curated interactions + real GSE54650 eigenvalues | Literature + Real Data | Hybrid: curated topology overlaid with computed eigenvalues |
| Ueda Molecular Timetable | GSE157357 organoid time-series (WT vs APC-KO) | Real Dataset (GEO) | Strongest benchmark: cross-condition prediction, non-circular |

## Evidence Strength Hierarchy

1. **Strongest**: Ueda cross-condition test (real data, non-circular prediction)
2. **Strong**: STRING network overlay (real eigenvalues, curated topology)
3. **Moderate**: Fisher information model (theoretical but biologically motivated)
4. **Weakest as standalone**: Turing simulation (circular by design, but see real-data validation below)

## Turing Real-Data Validation (Tissue Architecture Test)

To address the circularity of the Turing simulation, we tested whether tissues with known spatial
architecture (liver lobules, kidney nephrons, cerebellar layers) have systematically different
eigenvalue profiles than tissues without pronounced spatial patterns (adipose tissue, muscle).

### Results
- Spatially patterned tissues (n=${rdv.tissueArchitectureTest.tissues.filter((t: any) => t.hasSpatialPatterns).length}): Mean |λ| = ${rdv.tissueArchitectureTest.patternedMean.toFixed(4)}
- Non-patterned tissues (n=${rdv.tissueArchitectureTest.tissues.filter((t: any) => !t.hasSpatialPatterns).length}): Mean |λ| = ${rdv.tissueArchitectureTest.nonPatternedMean.toFixed(4)}
- Mann-Whitney U test: p = ${rdv.tissueArchitectureTest.mannWhitneyP.toFixed(4)}
- Effect size (Cohen's d): ${rdv.tissueArchitectureTest.effectSize.toFixed(3)}
- **Verdict: ${rdv.tissueArchitectureTest.testResult}**

### Interpretation
${rdv.tissueArchitectureTest.interpretation}

### Limitations
${rdv.overallVerdict.limitations.map((l: string) => '- ' + l).join('\n')}

### Tissue-Level Data
| Tissue | Spatial Patterns | Identity |λ| | Clock |λ| | Prolif |λ| | Overall Mean |
|--------|-----------------|-----------|----------|----------|-------------|
${rdv.tissueArchitectureTest.tissues.map((t: any) => 
  `| ${t.tissue} | ${t.hasSpatialPatterns ? 'Yes' : 'No'} | ${t.identityMean.toFixed(4)} | ${t.clockMean.toFixed(4)} | ${t.prolifMean.toFixed(4)} | ${t.overallMean.toFixed(4)} |`
).join('\n')}

### Overall Assessment
${rdv.overallVerdict.summary}
`;
}
