"""Tests for the par2 I/O module."""

import csv
import math
import os
import sys

import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from par2.io import load_expression_matrix, save_results

EXAMPLE_CSV = os.path.join(os.path.dirname(__file__), "..", "data", "example_circadian.csv")


def write_csv(path, text):
    path.write_text(text)
    return str(path)


def test_load_expression_matrix(tmp_path):
    path = write_csv(
        tmp_path / "expr.csv",
        "Gene,ZT0,ZT2,ZT4\nPer2,1,2,3\nArntl,4,5,6\n",
    )
    matrix, genes = load_expression_matrix(path)
    assert genes == ["Per2", "Arntl"]
    assert matrix.shape == (2, 3)
    np.testing.assert_allclose(matrix, [[1, 2, 3], [4, 5, 6]])


def test_load_expression_matrix_strips_quotes_and_whitespace(tmp_path):
    path = write_csv(tmp_path / "expr.csv", 'Gene,T1,T2\n" Per2 ", 1 , 2 \n')
    matrix, genes = load_expression_matrix(path)
    assert genes == ["Per2"]
    np.testing.assert_allclose(matrix, [[1, 2]])


def test_load_expression_matrix_non_numeric_becomes_nan(tmp_path):
    path = write_csv(tmp_path / "expr.csv", "Gene,T1,T2\nPer2,1,NA\n")
    matrix, _ = load_expression_matrix(path)
    assert matrix[0, 0] == 1
    assert math.isnan(matrix[0, 1])


def test_load_expression_matrix_pads_ragged_rows(tmp_path):
    """Short rows are padded with NaN so the matrix stays rectangular."""
    path = write_csv(tmp_path / "expr.csv", "Gene,T1,T2,T3\nPer2,1,2,3\nMyc,4,5\n")
    matrix, genes = load_expression_matrix(path)
    assert genes == ["Per2", "Myc"]
    assert matrix.shape == (2, 3)
    assert math.isnan(matrix[1, 2])


def test_load_expression_matrix_skips_unnamed_and_empty_rows(tmp_path):
    path = write_csv(tmp_path / "expr.csv", "Gene,T1,T2\nPer2,1,2\n,3,4\nMyc\n")
    _, genes = load_expression_matrix(path)
    assert genes == ["Per2"]


def test_load_expression_matrix_tab_delimited(tmp_path):
    path = write_csv(tmp_path / "expr.tsv", "Gene\tT1\tT2\nPer2\t1\t2\n")
    matrix, genes = load_expression_matrix(path, delimiter="\t")
    assert genes == ["Per2"]
    np.testing.assert_allclose(matrix, [[1, 2]])


def test_load_expression_matrix_extra_metadata_columns(tmp_path):
    """gene_col/skip_cols allow annotation columns before the expression values."""
    path = write_csv(tmp_path / "expr.csv", "Gene,Chr,T1,T2\nPer2,chr11,1,2\n")
    matrix, genes = load_expression_matrix(path, gene_col=0, skip_cols=2)
    assert genes == ["Per2"]
    np.testing.assert_allclose(matrix, [[1, 2]])


def test_load_bundled_example_dataset():
    matrix, genes = load_expression_matrix(EXAMPLE_CSV)
    assert len(genes) == matrix.shape[0] == 30
    assert matrix.shape[1] == 12
    assert not np.isnan(matrix).any()


def test_save_results_round_trip(tmp_path):
    out = tmp_path / "results.csv"
    results = [
        {"gene": "Per2", "eigenvalue": 0.7, "phi1": 1.0, "phi2": -0.5,
         "r2": 0.9, "root_type": "Complex", "half_life": 3.9, "eigenperiod": 24.0},
        {"gene": "Myc", "eigenvalue": 0.5, "phi1": 0.4, "phi2": -0.25,
         "r2": 0.6, "root_type": "Real", "half_life": 2.0, "eigenperiod": float("nan")},
    ]
    save_results(results, str(out))

    with open(out) as f:
        rows = list(csv.DictReader(f))
    assert [r["gene"] for r in rows] == ["Per2", "Myc"]
    assert float(rows[0]["eigenvalue"]) == 0.7
    assert rows[1]["root_type"] == "Real"


def test_save_results_writes_only_present_columns(tmp_path):
    out = tmp_path / "results.csv"
    save_results([{"gene": "Per2", "eigenvalue": 0.7, "extra": "ignored"}], str(out))
    header = out.read_text().splitlines()[0]
    assert header == "gene,eigenvalue"


def test_save_results_empty_writes_nothing(tmp_path):
    out = tmp_path / "results.csv"
    save_results([], str(out))
    assert not out.exists()
