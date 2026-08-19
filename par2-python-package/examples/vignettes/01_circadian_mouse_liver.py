"""
PAR(2) Vignette 1: Circadian Gene Expression in Mouse Liver
============================================================

Dataset: GSE54650 (Zhang et al., PNAS 2014)
  - Mouse liver, 12 timepoints (ZT0-ZT22, every 2 hours)
  - ~21,000 genes

This vignette demonstrates the core PAR(2) workflow:
  1. Load expression data
  2. Fit AR(2) to every gene
  3. Discover the three-layer hierarchy (Clock > Target > Background)
  4. Interpret eigenvalue modulus |λ| as temporal persistence

Expected result: Clock genes (Per2, Arntl, Cry1, ...) show |λ| ≈ 0.65-0.75,
well above target genes (Myc, Ccnd1, Tp53, ...) at |λ| ≈ 0.50-0.60, which
are above background at |λ| ≈ 0.45-0.50.
"""

import numpy as np
import par2

# ── Generate realistic mouse liver circadian data ──
# (In practice, download GSE54650 from GEO and format as CSV)
rng = np.random.RandomState(42)
n_timepoints = 12
t = np.linspace(0, 22, n_timepoints)  # ZT0 to ZT22

def make_gene(mean, amplitude, phase_hours, noise_frac=0.1):
    signal = mean + amplitude * np.cos(2 * np.pi * (t - phase_hours) / 24)
    noise = rng.randn(n_timepoints) * mean * noise_frac
    return np.maximum(0.1, signal + noise)

# Core clock genes — strong, autonomous 24h oscillation
clock_genes = {
    "Per2":  make_gene(10.0, 2.5, 6),
    "Arntl": make_gene(12.0, 3.0, 0),
    "Cry1":  make_gene(9.0,  2.0, 8),
    "Nr1d1": make_gene(10.0, 2.8, 4),
    "Dbp":   make_gene(10.0, 3.5, 3),
    "Clock": make_gene(11.0, 1.2, 0.5),
}

# Clock-controlled target genes — weaker, driven oscillation
target_genes = {
    "Myc":    make_gene(8.0, 0.9, 10),
    "Ccnd1":  make_gene(9.0, 1.0, 11),
    "Wee1":   make_gene(7.5, 1.2, 5),
    "Tp53":   make_gene(8.0, 0.7, 9),
    "Cdkn1a": make_gene(7.0, 0.8, 8),
}

# Background / housekeeping genes — no circadian regulation
background_genes = {
    "Gapdh": make_gene(12.0, 0.1, 0, noise_frac=0.05),
    "Actb":  make_gene(11.5, 0.15, 0, noise_frac=0.05),
    "Rps18": make_gene(10.0, 0.05, 0, noise_frac=0.03),
    "Hprt":  make_gene(9.0,  0.08, 0, noise_frac=0.04),
    "Tubb":  make_gene(10.5, 0.12, 0, noise_frac=0.06),
}

# Combine into matrix
all_genes = {**clock_genes, **target_genes, **background_genes}
gene_names = list(all_genes.keys())
matrix = np.vstack([all_genes[g] for g in gene_names])

# ── Step 1: Batch AR(2) fitting ──
print("=" * 60)
print("PAR(2) Analysis: Mouse Liver Circadian (GSE54650-like)")
print("=" * 60)

results = par2.fit_ar2_batch(matrix, gene_names)
print(f"\nFitted {len(results)} genes")

# ── Step 2: Per-gene results ──
print("\nTop 10 genes by eigenvalue:")
print(f"  {'Gene':10s} {'|λ|':>8s} {'Type':>10s} {'R²':>8s} {'Class'}")
print("  " + "-" * 55)
for r in results[:10]:
    cls = par2.classify_dynamics(r["eigenvalue"], r["root_type"])
    print(f"  {r['gene']:10s} {r['eigenvalue']:8.4f} {r['root_type']:>10s} {r['r2']:8.4f} {cls}")

# ── Step 3: Hierarchy discovery ──
hierarchy = par2.discover_hierarchy(results)

print(f"\nThree-Layer Hierarchy:")
print(f"  Clock genes:      median |λ| = {hierarchy['clock_median']:.4f}  (n={hierarchy['n_clock']})")
print(f"  Target genes:     median |λ| = {hierarchy['target_median']:.4f}  (n={hierarchy['n_target']})")
print(f"  Background genes: median |λ| = {hierarchy['background_median']:.4f}  (n={hierarchy['n_background']})")
print(f"\n  Gearbox gap:         {hierarchy['gearbox_gap']:.4f}")
print(f"  Hierarchy preserved: {hierarchy['hierarchy_preserved']}")
print(f"  Health grade:        {hierarchy['health_grade']}")

# ── Step 4: Derived metrics ──
print("\nDerived metrics for top clock genes:")
for gene, ev in hierarchy["clock_genes"][:3]:
    hl = par2.half_life(ev, sampling_interval=2.0)
    print(f"  {gene:8s}: |λ| = {ev:.4f}, half-life = {hl:.1f} hours")

# ── Step 5: Save results ──
par2.save_results(results, "mouse_liver_results.csv")
print("\nResults saved to mouse_liver_results.csv")
