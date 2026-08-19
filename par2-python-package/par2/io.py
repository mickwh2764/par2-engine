"""I/O utilities for loading expression data and saving results."""

import csv
import os
from typing import Dict, List, Optional, Tuple

import numpy as np


def load_expression_matrix(
    filepath: str,
    gene_col: int = 0,
    skip_cols: int = 1,
    delimiter: str = ",",
) -> Tuple[np.ndarray, List[str]]:
    """Load a gene expression CSV into a matrix and gene name list.

    Parameters
    ----------
    filepath : str
        Path to CSV file. First row is header; first column is gene names.
    gene_col : int
        Column index for gene names (default 0).
    skip_cols : int
        Number of leading columns to skip before expression values (default 1).
    delimiter : str
        Field delimiter (default ',').

    Returns
    -------
    (matrix, gene_names) where matrix is ndarray of shape (n_genes, n_timepoints).
    """
    gene_names: List[str] = []
    rows: List[List[float]] = []

    with open(filepath, "r") as f:
        reader = csv.reader(f, delimiter=delimiter)
        header = next(reader)
        for row in reader:
            if len(row) <= skip_cols:
                continue
            name = row[gene_col].strip().strip('"')
            if not name:
                continue
            vals = []
            for v in row[skip_cols:]:
                try:
                    vals.append(float(v.strip()))
                except ValueError:
                    vals.append(float("nan"))
            gene_names.append(name)
            rows.append(vals)

    max_len = max(len(r) for r in rows) if rows else 0
    matrix = np.full((len(rows), max_len), np.nan)
    for i, r in enumerate(rows):
        matrix[i, : len(r)] = r

    return matrix, gene_names


def save_results(
    results: List[Dict],
    filepath: str,
    delimiter: str = ",",
) -> None:
    """Save AR(2) results to a CSV file.

    Parameters
    ----------
    results : list of dicts from fit_ar2 or fit_ar2_batch
    filepath : str
        Output CSV path.
    """
    if not results:
        return

    cols = ["gene", "eigenvalue", "phi1", "phi2", "r2", "root_type", "half_life", "eigenperiod"]
    present = [c for c in cols if c in results[0]]

    with open(filepath, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=present, delimiter=delimiter, extrasaction="ignore")
        writer.writeheader()
        for r in results:
            writer.writerow({k: r.get(k, "") for k in present})
