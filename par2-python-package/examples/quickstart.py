"""Quick-start example for par2-circadian."""

import os
import sys
import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import par2

# ── Single gene analysis ──
t = np.arange(0, 48, 2)
bmal1 = 2.0 * np.cos(2 * np.pi * t / 24) + 0.3 * np.random.randn(len(t))

print("=== Single gene analysis ===")
result = par2.fit_ar2(bmal1)
print(f"Bmal1: |λ| = {result['eigenvalue']:.3f}, type = {result['root_type']}")
print(f"  Half-life = {result['half_life']} intervals")
print(f"  Eigenperiod = {result['eigenperiod']} intervals")
print(f"  Classification = {par2.classify_dynamics(result['eigenvalue'], result['root_type'])}")

# ── Batch analysis ──
per2 = 1.5 * np.cos(2 * np.pi * t / 24 + np.pi) * np.exp(-0.02 * t) + 0.3 * np.random.randn(len(t))
noise = np.random.randn(len(t))

print("\n=== Batch analysis ===")
matrix = np.vstack([bmal1, per2, noise])
genes = ["Arntl", "Per2", "Noise"]
results = par2.fit_ar2_batch(matrix, genes)
for r in results:
    print(f"  {r['gene']:8s}: |λ| = {r['eigenvalue']:.3f} ({r['root_type']})")

# ── Hierarchy discovery ──
print("\n=== Hierarchy discovery (example dataset) ===")
data_path = os.path.join(os.path.dirname(__file__), "..", "data", "example_circadian.csv")
matrix, gene_names = par2.load_expression_matrix(data_path)
all_results = par2.fit_ar2_batch(matrix, gene_names)

hierarchy = par2.discover_hierarchy(all_results)
print(f"  Clock median:      {hierarchy['clock_median']:.4f} (n={hierarchy['n_clock']})")
print(f"  Target median:     {hierarchy['target_median']:.4f} (n={hierarchy['n_target']})")
print(f"  Background median: {hierarchy['background_median']:.4f} (n={hierarchy['n_background']})")
print(f"  Gearbox gap:       {hierarchy['gearbox_gap']:.4f}")
print(f"  Hierarchy preserved: {hierarchy['hierarchy_preserved']}")
print(f"  Health grade: {hierarchy['health_grade']}")

print("\n  Top clock genes:")
for gene, ev in hierarchy['clock_genes'][:5]:
    print(f"    {gene:8s} |λ| = {ev:.4f}")

# ── Save results ──
print("\n=== Save to CSV ===")
par2.save_results(all_results, "example_output.csv")
print("Results saved to example_output.csv")
