# par2-circadian

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

## Method

The AR(2) model fits:

```
x(t) = φ₁·x(t-1) + φ₂·x(t-2) + ε
```

The characteristic equation r² − φ₁r − φ₂ = 0 yields eigenvalues whose modulus |λ| quantifies temporal persistence. Expression values are mean-centred before fitting.

For complex roots: |λ| = √(−φ₂)
For real roots: |λ| = max(|r₁|, |r₂|)

The three-layer hierarchy emerges because clock genes (strong autonomous oscillation) have higher |λ| than clock-controlled target genes (driven oscillation), which in turn have higher |λ| than background genes (no circadian regulation).

See: Whiteside M (2026). "AR(2) eigenvalue modulus as a measure of temporal persistence in circadian gene expression." *Research Square* [Preprint]. doi:10.21203/rs.3.rs-9283100/v1

## Researcher Profile

**Michael Whiteside** — independent computational systems researcher  
[Researcher Profile](https://par2discovery.com/profile) · [ORCID 0009-0000-0643-5791](https://orcid.org/0009-0000-0643-5791) · [par2discovery.com](https://par2discovery.com)

## AI Usage Statement

An AI coding agent (Replit Agent, Anthropic/Replit) was used to assist with implementation of platform modules and translation of analytical specifications into code. Each module was specified by the author in terms of mathematical requirements and validation criteria, implemented by the agent, and verified against known analytical results before incorporation.

Large language models (Claude, Anthropic; GPT-4, OpenAI) were used for drafting, structural editing, and refinement of documentation and manuscript text. All scientific content — the analytical framework, hypothesis design, dataset selection, validation architecture, and scientific interpretation — originated with and was decided by the author.

The AR(2) framework, the eigenvalue hierarchy hypothesis, and all scientific judgements are the author's own. The responsibility for the correctness and adequacy of all results remains exclusively with the human author.

## License

PolyForm Noncommercial License 1.0.0 — free for noncommercial use. **Commercial
use requires a separate commercial license** (contact mickwh@msn.com). See
[LICENSE](LICENSE) for details. The PAR(2) methodology is the subject of a pending
UK patent application, covering the methodology independently of this software license.

If you use this software in academic work, please cite:

> Whiteside M (2026). "AR(2) eigenvalue modulus as a measure of temporal persistence in circadian gene expression." *Research Square* [Preprint]. doi:10.21203/rs.3.rs-9283100/v1

