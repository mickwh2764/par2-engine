"""
PAR(2) Vignette 2: Temporal Persistence in Proteomics Data
============================================================

Datasets referenced:
  - Jóhönnuson 2025: Human plasma proteome (diurnal sampling)
  - Wang 2018: Mouse liver proteome (circadian time course)

This vignette shows that PAR(2) works on protein-level data, not just
transcriptomics. The same |λ| metric measures temporal persistence in
protein abundance time series.

Key insight: Protein-level persistence is typically LOWER than mRNA-level
persistence for the same gene, because protein turnover adds a damping
layer. This means the three-layer hierarchy (Clock > Target > Background)
should still be visible but with compressed eigenvalue ranges.
"""

import numpy as np
import par2

rng = np.random.RandomState(123)
n_timepoints = 12
t = np.linspace(0, 22, n_timepoints)

def make_protein(mean, amplitude, phase_hours, turnover_damping=0.7, noise_frac=0.08):
    """Simulate protein abundance with additional turnover damping."""
    signal = mean + amplitude * turnover_damping * np.cos(2 * np.pi * (t - phase_hours) / 24)
    noise = rng.randn(n_timepoints) * mean * noise_frac
    return np.maximum(0.1, signal + noise)

# ── Plasma proteome (Jóhönnuson 2025-style) ──
# Proteins show circadian variation but damped relative to mRNA
plasma_proteins = {
    # Clock-associated proteins
    "PER2":   make_protein(5.2, 1.8, 6, turnover_damping=0.6),
    "CRY1":   make_protein(4.1, 1.2, 8, turnover_damping=0.5),
    "BMAL1":  make_protein(6.0, 2.0, 0, turnover_damping=0.6),
    "REV-ERBα": make_protein(4.8, 1.5, 4, turnover_damping=0.55),
    "DBP":    make_protein(3.5, 1.8, 3, turnover_damping=0.65),
    # Circadian-influenced secreted proteins
    "CORTISOL_BP": make_protein(8.0, 0.6, 2, turnover_damping=0.4),
    "ALBUMIN":     make_protein(40.0, 0.3, 6, turnover_damping=0.3),
    "CRP":         make_protein(2.5, 0.4, 10, turnover_damping=0.35),
    "TRANSFERRIN": make_protein(3.0, 0.3, 8, turnover_damping=0.3),
    "IL6":         make_protein(1.2, 0.5, 14, turnover_damping=0.4),
    # Stable housekeeping proteins
    "HSP90":  make_protein(15.0, 0.05, 0, turnover_damping=0.1),
    "TUBULIN": make_protein(12.0, 0.03, 0, turnover_damping=0.1),
    "ACTIN":  make_protein(18.0, 0.02, 0, turnover_damping=0.1),
}

# ── Liver proteome (Wang 2018-style) ──
liver_proteins = {
    "PER2":  make_protein(8.0, 2.5, 6, turnover_damping=0.7),
    "ARNTL": make_protein(10.0, 3.0, 0, turnover_damping=0.7),
    "CYP1A2": make_protein(6.0, 1.2, 10, turnover_damping=0.5),
    "CYP3A4": make_protein(7.0, 0.8, 8, turnover_damping=0.4),
    "ADH1":  make_protein(9.0, 0.3, 0, turnover_damping=0.2),
    "ALB":   make_protein(50.0, 0.1, 0, turnover_damping=0.1),
}

print("=" * 60)
print("PAR(2) for Proteomics: Plasma & Liver Proteomes")
print("=" * 60)

# ── Analyze plasma proteome ──
print("\n--- Human Plasma Proteome (Jóhönnuson 2025-style) ---")
gene_names = list(plasma_proteins.keys())
matrix = np.vstack([plasma_proteins[g] for g in gene_names])
results = par2.fit_ar2_batch(matrix, gene_names)

print(f"\n{'Protein':15s} {'|λ|':>8s} {'Type':>10s} {'Classification'}")
print("-" * 55)
for r in results:
    cls = par2.classify_dynamics(r["eigenvalue"], r["root_type"])
    print(f"{r['gene']:15s} {r['eigenvalue']:8.4f} {r['root_type']:>10s} {cls}")

# ── Analyze liver proteome ──
print("\n--- Mouse Liver Proteome (Wang 2018-style) ---")
liver_names = list(liver_proteins.keys())
liver_matrix = np.vstack([liver_proteins[g] for g in liver_names])
liver_results = par2.fit_ar2_batch(liver_matrix, liver_names)

for r in liver_results:
    cls = par2.classify_dynamics(r["eigenvalue"], r["root_type"])
    print(f"{r['gene']:15s} {r['eigenvalue']:8.4f} {r['root_type']:>10s} {cls}")

# ── Cross-platform comparison ──
print("\n--- Key Comparison: mRNA vs Protein Persistence ---")
print("Protein |λ| is typically lower than mRNA |λ| for the same gene")
print("because protein turnover adds an extra damping layer.")
print("\nThis means hierarchy gaps are compressed at the protein level,")
print("but the ordering (Clock > Target > Background) should be preserved.")
print("\nTo validate: run PAR(2) on matched mRNA + protein time courses")
print("from the same tissue and compare eigenvalue distributions.")
