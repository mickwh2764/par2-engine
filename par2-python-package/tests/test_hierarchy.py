"""Tests for the par2 hierarchy module."""

import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from par2.hierarchy import (
    classify_gene_layer,
    discover_hierarchy,
    gearbox_gap,
)


def make_results(pairs):
    return [{"gene": gene, "eigenvalue": ev} for gene, ev in pairs]


def test_classify_gene_layer():
    assert classify_gene_layer("Per2") == "Clock"
    assert classify_gene_layer("ARNTL") == "Clock"
    assert classify_gene_layer("Myc") == "Target"
    assert classify_gene_layer("CCND1") == "Target"
    assert classify_gene_layer("Actb") == "Background"


def test_classify_gene_layer_is_case_sensitive():
    """Matching is exact: only the symbol casings in the built-in lists match."""
    assert classify_gene_layer("per2") == "Background"


def test_discover_hierarchy_layers_and_gap():
    results = make_results([
        ("Per2", 0.70), ("Arntl", 0.80),
        ("Myc", 0.50), ("Ccnd1", 0.60),
        ("Actb", 0.40), ("Gapdh", 0.30),
    ])
    h = discover_hierarchy(results)

    assert (h["n_clock"], h["n_target"], h["n_background"]) == (2, 2, 2)
    assert h["clock_median"] == 0.75
    assert h["target_median"] == 0.55
    assert h["background_median"] == 0.35
    assert h["gearbox_gap"] == pytest.approx(0.20)
    assert h["hierarchy_preserved"] is True
    assert h["health_grade"] == "A"


def test_discover_hierarchy_sorts_detail_descending():
    results = make_results([("Per2", 0.60), ("Arntl", 0.90), ("Myc", 0.40), ("Wee1", 0.55)])
    h = discover_hierarchy(results)
    assert h["clock_genes"] == [("Arntl", 0.90), ("Per2", 0.60)]
    assert h["target_genes"] == [("Wee1", 0.55), ("Myc", 0.40)]


@pytest.mark.parametrize(
    "gap, grade",
    [(0.20, "A"), (0.15, "A"), (0.12, "B"), (0.10, "B"), (0.07, "C"),
     (0.05, "C"), (0.03, "D"), (0.02, "D"), (0.01, "F"), (-0.10, "F")],
)
def test_health_grade_boundaries(gap, grade):
    results = make_results([("Per2", gap), ("Myc", 0.0)])
    assert discover_hierarchy(results)["health_grade"] == grade


def test_hierarchy_collapse_is_detected():
    """Targets above clock genes (as in disease states) breaks the hierarchy."""
    results = make_results([("Per2", 0.40), ("Myc", 0.60), ("Actb", 0.30)])
    h = discover_hierarchy(results)
    assert h["hierarchy_preserved"] is False
    assert h["gearbox_gap"] < 0
    assert h["health_grade"] == "F"


def test_discover_hierarchy_custom_clock_set():
    """A custom clock set reclassifies genes that are otherwise background."""
    results = make_results([("Toc1", 0.80), ("Per2", 0.70), ("Myc", 0.50)])
    h = discover_hierarchy(results, clock_genes={"Toc1"})
    assert h["n_clock"] == 1
    assert h["clock_median"] == 0.80
    assert h["n_background"] == 1  # Per2 is no longer a clock gene


def test_discover_hierarchy_empty_results():
    h = discover_hierarchy([])
    assert h["clock_median"] == 0.0
    assert h["target_median"] == 0.0
    assert h["gearbox_gap"] == 0.0
    assert h["hierarchy_preserved"] is False
    assert h["health_grade"] == "F"


def test_gearbox_gap():
    assert gearbox_gap([0.7, 0.8], [0.5, 0.6]) == pytest.approx(0.2)
    assert gearbox_gap([], [0.5]) == 0.0
    assert gearbox_gap([0.7], []) == 0.0
