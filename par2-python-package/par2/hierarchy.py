"""Three-layer hierarchy discovery and gearbox gap analysis.

The PAR(2) hierarchy separates genes into three tiers based on eigenvalue
modulus |lambda|:
  - Clock genes:      high persistence (|lambda| ~ 0.65-0.75)
  - Target genes:     intermediate persistence (|lambda| ~ 0.50-0.60)
  - Background genes: low persistence (|lambda| ~ 0.45-0.50)

The "gearbox gap" between clock and target median eigenvalues serves as a
circadian health metric — disruption collapses the gap.
"""

from typing import Dict, List, Optional, Tuple
import numpy as np

CORE_CLOCK_GENES = {
    "Per1", "Per2", "Per3", "Cry1", "Cry2", "Clock", "Arntl", "Bmal1",
    "Nr1d1", "Nr1d2", "Dbp", "Tef", "Npas2", "Rorc", "Rora",
    "ARNTL", "PER1", "PER2", "PER3", "CRY1", "CRY2", "CLOCK",
    "NR1D1", "NR1D2", "DBP", "TEF", "NPAS2", "RORC", "RORA",
}

KNOWN_TARGET_GENES = {
    "Myc", "Ccnd1", "Wee1", "Chek2", "Tp53", "Cdkn1a", "Bcl2", "Bax",
    "Ccne1", "Ccne2", "Mcm6", "Mki67", "Lgr5", "Axin2",
    "MYC", "CCND1", "WEE1", "CHEK2", "TP53", "CDKN1A", "BCL2", "BAX",
    "CCNE1", "CCNE2", "MCM6", "MKI67", "LGR5", "AXIN2",
}


def classify_gene_layer(gene_name: str) -> str:
    """Classify a gene into Clock, Target, or Background based on known lists.

    Parameters
    ----------
    gene_name : str
        Gene symbol (case-insensitive matching).

    Returns
    -------
    str : 'Clock', 'Target', or 'Background'
    """
    if gene_name in CORE_CLOCK_GENES:
        return "Clock"
    if gene_name in KNOWN_TARGET_GENES:
        return "Target"
    return "Background"


def discover_hierarchy(
    results: List[Dict],
    clock_genes: Optional[set] = None,
) -> Dict:
    """Discover the three-layer hierarchy from AR(2) batch results.

    Separates genes by known clock/target lists (or custom clock set),
    computes layer medians, and returns the gearbox gap.

    Parameters
    ----------
    results : list of dicts
        Output from fit_ar2_batch (must include 'gene' and 'eigenvalue' keys).
    clock_genes : set, optional
        Custom set of clock gene names. Defaults to CORE_CLOCK_GENES.

    Returns
    -------
    dict with keys:
        clock_median : float
        target_median : float
        background_median : float
        gearbox_gap : float         -- clock_median - target_median
        hierarchy_preserved : bool  -- True if clock > target > background
        n_clock : int
        n_target : int
        n_background : int
        clock_genes : list of (gene, eigenvalue) tuples
        target_genes : list of (gene, eigenvalue) tuples
        health_grade : str          -- A-F based on gearbox gap
    """
    if clock_genes is None:
        clock_genes = CORE_CLOCK_GENES

    clock_vals = []
    target_vals = []
    background_vals = []
    clock_detail = []
    target_detail = []

    for r in results:
        gene = r.get("gene", "")
        ev = r.get("eigenvalue", 0)
        if gene in clock_genes:
            clock_vals.append(ev)
            clock_detail.append((gene, ev))
        elif gene in KNOWN_TARGET_GENES:
            target_vals.append(ev)
            target_detail.append((gene, ev))
        else:
            background_vals.append(ev)

    clock_med = float(np.median(clock_vals)) if clock_vals else 0.0
    target_med = float(np.median(target_vals)) if target_vals else 0.0
    bg_med = float(np.median(background_vals)) if background_vals else 0.0
    gap = clock_med - target_med

    if gap >= 0.15:
        grade = "A"
    elif gap >= 0.10:
        grade = "B"
    elif gap >= 0.05:
        grade = "C"
    elif gap >= 0.02:
        grade = "D"
    else:
        grade = "F"

    clock_detail.sort(key=lambda x: x[1], reverse=True)
    target_detail.sort(key=lambda x: x[1], reverse=True)

    return {
        "clock_median": round(clock_med, 4),
        "target_median": round(target_med, 4),
        "background_median": round(bg_med, 4),
        "gearbox_gap": round(gap, 4),
        "hierarchy_preserved": clock_med > target_med > bg_med,
        "n_clock": len(clock_vals),
        "n_target": len(target_vals),
        "n_background": len(background_vals),
        "clock_genes": clock_detail,
        "target_genes": target_detail,
        "health_grade": grade,
    }


def gearbox_gap(clock_eigenvalues: List[float], target_eigenvalues: List[float]) -> float:
    """Compute the gearbox gap between clock and target gene eigenvalue medians.

    Parameters
    ----------
    clock_eigenvalues : list of float
    target_eigenvalues : list of float

    Returns
    -------
    float : median(clock) - median(target)
    """
    if not clock_eigenvalues or not target_eigenvalues:
        return 0.0
    return float(np.median(clock_eigenvalues) - np.median(target_eigenvalues))
