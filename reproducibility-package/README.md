# PAR(2) Discovery Engine — Reproducibility Package

Self-contained code, data, and results for reproducing the core AR(2) eigenvalue analysis from "AR(2) Eigenvalue Modulus as a Measure of Temporal Persistence in Gene Expression."

## Structure

```
reproducibility-package/
├── datasets/
│   ├── gse54650_liver.csv       # Hughes Atlas mouse liver (20,955 genes × 24 timepoints, 2h intervals)
│   ├── gse11923_liver.csv       # Hughes 2009 mouse liver (21,500 genes × 48 timepoints, 1h intervals)
│   └── gse157357_wt.csv         # Rosselot 2022 mouse intestinal organoids (WT-WT)
├── code/
│   ├── ar2_model.ts             # AR(2) model fitting with mean-centering and eigenvalue extraction
│   ├── eigenvalue_solver.ts     # Full eigenvalue decomposition: modulus, argument, eigenperiod, damping
│   └── preprocess.ts            # CSV loading, Ensembl-to-symbol mapping, mean-centering, z-scoring
├── simulations/
│   ├── boman_simulation.ts      # Boman-style 3-compartment crypt model with parameter sweep
│   └── renewal_abm.ts           # Minimal agent-based crypt model: WT vs BMAL1-KO mutation accumulation
├── results/
│   ├── gene_lambdas.csv         # Per-gene AR(2) results for GSE54650 liver (20,955 genes)
│   ├── category_tests.csv       # Nine-category statistical tests across 12 mouse tissues
│   ├── permutation_null.csv     # 10,000-permutation null distribution for clock gene median |λ|
│   └── permutation_summary.csv  # Summary statistics for permutation test
├── config/
│   └── gene_categories.json     # Nine functional categories, Ensembl mappings, aliases
└── README.md
```

## Key Results (from results/ CSVs)

**Eigenvalue hierarchy (GSE54650 liver, median |λ|):**
- Clock: 0.647 (n=16, p_adj=0.007)
- Chromatin: 0.594 (n=26, p_adj=0.097)
- Metabolic: 0.537, Target: 0.529, Signaling: 0.491, Housekeeping: 0.484
- DNA Repair: 0.479, Immune: 0.458, Stem Cell: 0.400
- Background: 0.496

**Permutation test:** Observed clock median (0.647) vs null median (0.496), p < 0.001 (10,000 permutations).

**Grand means across 12 tissues:** Clock=0.647 (median) / 0.689 (mean), Target=0.529 (median) / 0.537 (mean), Background=0.496. Gap positive in 12/12 tissues.

## How to Reproduce

### Prerequisites
- Node.js 18+ with TypeScript
- Or Python 3.8+ (the AR(2) fitting logic is straightforward to reimplement)

### Core AR(2) Computation

The AR(2) model fits y(t) = β₁·y(t-1) + β₂·y(t-2) + ε(t) to **mean-centered** gene expression time series. The eigenvalue modulus |λ| = max(|λ₁|, |λ₂|) where λ₁, λ₂ are roots of the characteristic polynomial z² - β₁·z - β₂ = 0.

For complex conjugate roots (discriminant < 0): |λ| = √(-β₂)
For real roots (discriminant ≥ 0): |λ| = max(|r₁|, |r₂|)

See `code/ar2_model.ts` for the complete implementation.

### Running the Analysis

```typescript
import { fitAR2 } from "./code/ar2_model";
import { loadCSV, resolveGeneName } from "./code/preprocess";

const genes = loadCSV("datasets/gse54650_liver.csv");
for (const { gene, values } of genes) {
  const resolved = resolveGeneName(gene);
  const result = fitAR2(values);
  if (result) {
    console.log(`${resolved}: |λ|=${result.eigenvalue.toFixed(4)}, R²=${result.r2.toFixed(4)}`);
  }
}
```

## Data Sources

| Dataset | GEO Accession | Species | Tissue | Timepoints | Interval | Reference |
|---------|--------------|---------|--------|------------|----------|-----------|
| Hughes Atlas | GSE54650 | Mouse | 12 tissues | 24 | 2h | Zhang et al. 2014 PNAS |
| Hughes 2009 | GSE11923 | Mouse | Liver | 48 | 1h | Hughes et al. 2009 PLoS Genet |
| Organoid | GSE157357 | Mouse | Intestinal organoid | 24 | 2h | Rosselot et al. 2022 |

## Note on Large Files

The dataset CSVs and full gene_lambdas.csv may not be present in the GitHub `reproducibility-package/` directory due to file size limits. These files are available in the main repository under `datasets/` (with their original names: `GSE54650_Liver_circadian.csv`, `GSE11923_Liver_1h_48h_genes.csv`, `GSE157357_Organoid_WT-WT_circadian.csv`). All source data are also available directly from NCBI GEO.

## License

Data from NCBI GEO (public domain). Code: PolyForm Noncommercial License 1.0.0 —
free for noncommercial use; commercial use requires a separate commercial license
(contact mickwh@msn.com). See the repository [LICENSE](../LICENSE) and
[COMMERCIAL-LICENSE.md](../COMMERCIAL-LICENSE.md).
