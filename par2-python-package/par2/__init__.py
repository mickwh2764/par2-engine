"""PAR(2): AR(2) eigenvalue analysis for gene expression time series."""

from importlib.metadata import PackageNotFoundError, version as _pkg_version

try:
    __version__ = _pkg_version("par2-circadian")
except PackageNotFoundError:  # running from a source tree without installation
    __version__ = "1.1.8"

from .core import fit_ar2, fit_ar2_batch, bootstrap_ar2, classify_dynamics
from .io import load_expression_matrix, save_results
from .metrics import half_life, eigenperiod
from .hierarchy import (
    discover_hierarchy,
    gearbox_gap,
    classify_gene_layer,
    CORE_CLOCK_GENES,
    KNOWN_TARGET_GENES,
)

__all__ = [
    "fit_ar2",
    "fit_ar2_batch",
    "bootstrap_ar2",
    "classify_dynamics",
    "load_expression_matrix",
    "save_results",
    "half_life",
    "eigenperiod",
    "discover_hierarchy",
    "gearbox_gap",
    "classify_gene_layer",
    "CORE_CLOCK_GENES",
    "KNOWN_TARGET_GENES",
]
