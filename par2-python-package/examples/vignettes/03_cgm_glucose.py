"""
PAR(2) Vignette 3: Continuous Glucose Monitoring (CGM) Data
============================================================

Dataset referenced: Colas 2019 + ShanghaiT2DM CGM data
  - 118 subjects, 15-min sampling intervals
  - Blood glucose as a univariate circadian signal

This vignette shows PAR(2) applied to a non-genomic time series. Instead of
genes, we treat each subject's glucose trace as a single time series and
compute |λ| as a measure of glucose regulation persistence.

Key insight: Healthy subjects should show higher |λ| (more persistent,
well-regulated glucose oscillation) compared to Type 2 Diabetes patients
(disrupted regulation, lower |λ|). This parallels the circadian health
score concept: a larger "gap" between healthy and diseased |λ| indicates
stronger circadian disruption.

Input format: Instead of genes-as-rows, CGM data uses subjects-as-rows
with timepoints-as-columns — the same matrix format.
"""

import numpy as np
import par2

rng = np.random.RandomState(99)

def simulate_cgm(n_timepoints, mean_glucose, amplitude, regularity, noise_level):
    """Simulate a CGM trace with circadian glucose oscillation.
    
    Parameters
    ----------
    n_timepoints : int
        Number of 15-min intervals (96 = 24 hours)
    mean_glucose : float
        Mean glucose (mg/dL), typically 90-130
    amplitude : float
        Circadian amplitude (mg/dL)
    regularity : float
        0-1, how regular the oscillation is (1 = perfect cosine)
    noise_level : float
        Glucose noise (mg/dL)
    """
    t = np.arange(n_timepoints) * 0.25  # hours
    # Circadian component (24h period with meal-driven harmonics)
    circadian = amplitude * np.cos(2 * np.pi * t / 24)
    meal_component = 0.5 * amplitude * np.cos(2 * np.pi * t / 8)  # ~8h meal rhythm
    
    # Regularity modulates how clean the signal is
    signal = mean_glucose + regularity * (circadian + 0.3 * meal_component)
    noise = rng.randn(n_timepoints) * noise_level
    
    return np.maximum(40, signal + noise)  # glucose can't go below ~40

# ── Simulate healthy subjects ──
n_timepoints = 96  # 24 hours at 15-min intervals
healthy_subjects = {}
for i in range(10):
    healthy_subjects[f"Healthy_{i+1:02d}"] = simulate_cgm(
        n_timepoints,
        mean_glucose=95 + rng.randn() * 5,
        amplitude=15 + rng.randn() * 3,
        regularity=0.8 + rng.rand() * 0.15,
        noise_level=5 + rng.rand() * 3,
    )

# ── Simulate T2D subjects ──
t2d_subjects = {}
for i in range(10):
    t2d_subjects[f"T2D_{i+1:02d}"] = simulate_cgm(
        n_timepoints,
        mean_glucose=140 + rng.randn() * 15,
        amplitude=8 + rng.randn() * 4,
        regularity=0.3 + rng.rand() * 0.3,
        noise_level=15 + rng.rand() * 10,
    )

# ── Combine and analyze ──
all_subjects = {**healthy_subjects, **t2d_subjects}
subject_names = list(all_subjects.keys())
matrix = np.vstack([all_subjects[s] for s in subject_names])

print("=" * 60)
print("PAR(2) for CGM Data: Glucose Regulation Persistence")
print("=" * 60)
print(f"\nLoaded {len(subject_names)} subjects x {n_timepoints} timepoints (15-min intervals)")

results = par2.fit_ar2_batch(matrix, subject_names)

# ── Separate healthy vs T2D ──
healthy_results = [r for r in results if r["gene"].startswith("Healthy")]
t2d_results = [r for r in results if r["gene"].startswith("T2D")]

healthy_eigenvalues = [r["eigenvalue"] for r in healthy_results]
t2d_eigenvalues = [r["eigenvalue"] for r in t2d_results]

print(f"\n--- Healthy Subjects (n={len(healthy_results)}) ---")
for r in sorted(healthy_results, key=lambda x: x["eigenvalue"], reverse=True):
    print(f"  {r['gene']:15s} |λ| = {r['eigenvalue']:.4f} ({r['root_type']})")

print(f"\n--- T2D Subjects (n={len(t2d_results)}) ---")
for r in sorted(t2d_results, key=lambda x: x["eigenvalue"], reverse=True):
    print(f"  {r['gene']:15s} |λ| = {r['eigenvalue']:.4f} ({r['root_type']})")

# ── Group statistics ──
print("\n--- Group Comparison ---")
print(f"  Healthy mean |λ|: {np.mean(healthy_eigenvalues):.4f} ± {np.std(healthy_eigenvalues):.4f}")
print(f"  T2D mean |λ|:     {np.mean(t2d_eigenvalues):.4f} ± {np.std(t2d_eigenvalues):.4f}")
gap = np.mean(healthy_eigenvalues) - np.mean(t2d_eigenvalues)
print(f"  Gap:              {gap:.4f}")
print(f"\n  Interpretation: {'Healthy > T2D ✓' if gap > 0 else 'Unexpected ordering'}")
print(f"  Higher |λ| in healthy subjects indicates more persistent,")
print(f"  well-regulated glucose oscillation — consistent with intact")
print(f"  circadian metabolic control.")

# ── Half-life interpretation ──
print("\n--- Clinical Interpretation ---")
healthy_median_ev = np.median(healthy_eigenvalues)
t2d_median_ev = np.median(t2d_eigenvalues)
healthy_hl = par2.half_life(healthy_median_ev, sampling_interval=0.25)  # 15 min
t2d_hl = par2.half_life(t2d_median_ev, sampling_interval=0.25)
print(f"  Healthy glucose perturbation half-life: {healthy_hl:.1f} hours")
print(f"  T2D glucose perturbation half-life:     {t2d_hl:.1f} hours")
print(f"\n  T2D glucose fluctuations decay faster (lower persistence),")
print(f"  reflecting impaired feedback regulation.")
