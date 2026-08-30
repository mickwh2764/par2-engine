# par2-circadian

[![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.21963192.svg)](https://doi.org/10.5281/zenodo.21963192)

**AR(2) eigenvalue analysis for gene expression time series**

Fits second-order autoregressive models to gene expression data and computes the eigenvalue modulus |λ|, a single number that quantifies how strongly a gene's past determines its future (temporal persistence). Discovers the three-layer hierarchy: Clock > Target > Background.

## Installation

Requires Python 3.9 or later.

```bash
pip install par2-circadian
```

Or install from source:

```bash
git clone https://github.com/mickwh2764/par2discovery.git
cd par2discovery
pip install .
```

## Quick Start

### Python API

```python
import par2

# Single gene
result = par2.fit_ar2([1.2, 3.4, 2.1, 4.5, 3.2, 5.1, 2.8, 4.9, 3.5, 5.2, 2.9, 4.7])
print(f"|λ| = {result['eigenvalue']:.3f}, type = {result['root_type']}")

# Whole matrix from CSV
matrix, genes = par2.load_expression_matrix("my_data.csv")
results = par2.fit_ar2_batch(matrix, genes)

# Discover the three-layer hierarchy
hierarchy = par2.discover_hierarchy(results)
print(f"Clock median:  {hierarchy['clock_median']:.3f}")
print(f"Target median: {hierarchy['target_median']:.3f}")
print(f"Gearbox gap:   {hierarchy['gearbox_gap']:.3f}")
print(f"Health grade:  {hierarchy['health_grade']}")

# Save results
par2.save_results(results, "ar2_results.csv")
```

### Confidence intervals

A point estimate of |λ| from a short series is imprecise, so `fit_ar2` can return
a residual-bootstrap 95% interval alongside it:

```python
result = par2.fit_ar2(expression, n_bootstrap=2000, seed=1)
print(result["eigenvalue"], result["eigenvalue_ci"])
```

The residuals are resampled, the series regenerated from the fitted recursion and
the model refitted, so only the one observed series is needed — no biological
replicates, which most circadian designs do not provide. Intervals are opt-in and
absent unless `n_bootstrap > 0`.

### Command Line

```bash
# Analyse a CSV file (genes as rows, timepoints as columns)
par2 my_data.csv -o results.csv

# Show top 20 genes by eigenvalue
par2 my_data.csv --top 20
```

### Example Dataset

An example dataset is included at `data/example_circadian.csv` (30 genes x 12 timepoints) with known clock, target, and background genes showing realistic circadian dynamics:

```python
import par2

matrix, genes = par2.load_expression_matrix("data/example_circadian.csv")
results = par2.fit_ar2_batch(matrix, genes)
h = par2.discover_hierarchy(results)
print(f"Hierarchy preserved: {h['hierarchy_preserved']}")  # True
print(f"Health grade: {h['health_grade']}")  # A
```

## Input Format

CSV file with:
- First row: header (timepoint labels)
- First column: gene names
- Remaining columns: expression values (minimum 6 timepoints)

Example:
```
Gene,ZT0,ZT2,ZT4,ZT6,ZT8,ZT10,ZT12,ZT14,ZT16,ZT18,ZT20,ZT22
Bmal1,12.3,14.1,15.8,16.2,14.5,11.2,9.8,8.1,7.5,8.9,10.2,11.5
Per2,8.1,7.2,6.5,7.8,10.2,13.5,15.1,14.8,13.2,10.5,9.1,8.5
```

## Output

### Per-Gene Results

Each gene gets:
- **eigenvalue**: |λ|, the eigenvalue modulus (0 to ~1). Higher = more persistent.
- **phi1, phi2**: AR(2) coefficients
- **r2**: goodness of fit
- **root_type**: 'Complex' (oscillatory) or 'Real' (monotone decay)
- **half_life**: persistence half-life in sampling intervals
- **eigenperiod**: intrinsic oscillation period (complex roots only)

### Hierarchy Discovery

`discover_hierarchy()` returns:
- **clock_median / target_median / background_median**: layer-wise eigenvalue medians
- **gearbox_gap**: clock_median − target_median (the circadian health metric)
- **hierarchy_preserved**: True if clock > target > background
- **health_grade**: A (gap ≥ 0.15) through F (gap < 0.02)
- **clock_genes / target_genes**: per-gene eigenvalue lists

## Interpreting |λ|

| Range | Interpretation |
|-------|---------------|
| 0.8–1.0 | Sustained oscillator (e.g., core clock genes) |
| 0.5–0.8 | Damped oscillator (e.g., clock-controlled targets) |
| 0.3–0.5 | Weak persistence (e.g., downstream effectors) |
| 0.0–0.3 | Rapidly decaying / noise-dominated |

These bands describe groups of genes, not individual ones. At 24 evenly sampled
timepoints the 95% interval on a single gene's |λ| is typically ~0.4 wide, and
the estimator is biased upward below ~24 points, so a lone value can easily fall
in the wrong row. Report `eigenvalue_ci` with any per-gene number, compare groups
rather than genes, and do not interpret differences smaller than the interval.

## Method

The AR(2) model fits:

```
x(t) = φ₁·x(t-1) + φ₂·x(t-2) + ε
```

The characteristic equation r² − φ₁r − φ₂ = 0 yields eigenvalues whose modulus |λ| quantifies temporal persistence. Expression values are mean-centred before fitting.

For complex roots: |λ| = √(−φ₂)
For real roots: |λ| = max(|r₁|, |r₂|)

The three-layer hierarchy emerges because clock genes (strong autonomous oscillation) have higher |λ| than clock-controlled target genes (driven oscillation), which in turn have higher |λ| than background genes (no circadian regulation).

See: Whiteside M (2026). "AR(2) eigenvalue modulus as a measure of temporal persistence in gene expression: circadian hierarchy emerges from two coefficients." *Research Square* [Preprint]. doi:10.21203/rs.3.rs-9283100/v1

## Researcher Profile

**Michael Whiteside** — independent computational systems researcher  
[Researcher Profile](https://par2discovery.com/profile) · [ORCID 0009-0000-0643-5791](https://orcid.org/0009-0000-0643-5791) · [par2discovery.com](https://par2discovery.com)

## AI Usage Statement

An AI coding agent (Replit Agent, Anthropic/Replit) was used to assist with implementation of platform modules and translation of analytical specifications into code. Each module was specified by the author in terms of mathematical requirements and validation criteria, implemented by the agent, and verified against known analytical results before incorporation.

Large language models (Claude, Anthropic; GPT-4, OpenAI) were used for drafting, structural editing, and refinement of documentation and manuscript text. All scientific content — the analytical framework, hypothesis design, dataset selection, validation architecture, and scientific interpretation — originated with and was decided by the author.

The AR(2) framework, the eigenvalue hierarchy hypothesis, and all scientific judgements are the author's own. The responsibility for the correctness and adequacy of all results remains exclusively with the human author.

## License

Apache License 2.0 — free for any use, including commercial, see
[LICENSE](LICENSE). Releases up to and including 1.1.8 were published under
PolyForm Noncommercial 1.0.0; from 1.2.0 the package is open source, so that it
can be reviewed and depended on by the venues and pipelines that require an
OSI-approved licence.

The PAR(2) methodology is the subject of pending UK patent application
GB2518973.9. Section 3 of Apache-2.0 grants you a patent licence covering use of
*this software*; it does not grant rights to practise the methodology by other
means (see [NOTICE](NOTICE)). For that, contact mickwh@msn.com.

## Citation

Machine-readable metadata is in [`CITATION.cff`](CITATION.cff) — GitHub's "Cite
this repository" button reads it, as do Zenodo, `cffconvert` and most reference
managers. Please cite the software and the method preprint together:

> Whiteside M (2026). *par2-circadian: AR(2) eigenvalue analysis for gene
> expression time series*. Version 1.2.0. Zenodo.
> doi:10.5281/zenodo.21963192
>
> Whiteside M (2026). "AR(2) eigenvalue modulus as a measure of temporal
> persistence in gene expression: circadian hierarchy emerges from two
> coefficients." *Research Square* [Preprint]. doi:10.21203/rs.3.rs-9283100/v1

Every release is archived on Zenodo. `10.5281/zenodo.21963192` is the concept
DOI and always resolves to the latest version; cite a version DOI only when you
need to pin exactly what you ran.

In a Methods section, identify the software as `par2-circadian (RRID:SCR_028837)`.
The package is also registered in [bio.tools](https://bio.tools/par2-circadian) as
`biotools:par2-circadian`.

The full publication list lives at
<https://par2discovery.com/publications.bib> — one entry per work, every DOI
verified against Crossref or DataCite.
