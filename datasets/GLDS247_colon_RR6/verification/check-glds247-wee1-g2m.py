#!/usr/bin/env python3
"""Reproduce pooled, stratified and adjusted Wee1–G2M associations for Paper U."""

from __future__ import annotations

import argparse
import ast
import csv
from pathlib import Path

import numpy as np
from scipy import stats


GENE_SET_SOURCE = Path(__file__).resolve().parent / "g2m_symbols.py"
ISS_ROOT = (
    "(Space Flight & ~60 day & On ISS & Carcass)"
    "v(Ground Control & ~60 day & On Earth & Carcass)"
)


def extract_g2m_symbols() -> set[str]:
    tree = ast.parse(GENE_SET_SOURCE.read_text(encoding="utf-8"))
    for node in tree.body:
        if isinstance(node, ast.Assign) and any(
            isinstance(target, ast.Name) and target.id == "G2M_SYMBOLS"
            for target in node.targets
        ):
            return ast.literal_eval(node.value)
    raise ValueError("G2M_SYMBOLS not found")


def correlation(label: str, x: np.ndarray, y: np.ndarray) -> tuple[float, float]:
    result = stats.spearmanr(x, y)
    print(f"{label}: r={result.statistic:+.6f}, p={result.pvalue:.6f}, n={len(x)}")
    return float(result.statistic), float(result.pvalue)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--de-file", type=Path, required=True)
    parser.add_argument("--norm-counts", type=Path, required=True)
    args = parser.parse_args()

    symbols = extract_g2m_symbols()
    lfc_col = f"Log2fc_{ISS_ROOT}"
    fdr_col = f"Adj.p.value_{ISS_ROOT}"
    de_by_symbol: dict[str, dict[str, str]] = {}
    with args.de_file.open(newline="", encoding="utf-8-sig") as handle:
        for row in csv.DictReader(handle):
            symbol = (row.get("SYMBOL") or "").strip('"')
            if symbol in symbols or symbol == "Wee1":
                de_by_symbol[symbol] = row

    with args.norm_counts.open(newline="", encoding="utf-8-sig") as handle:
        reader = csv.DictReader(handle)
        sample_columns = [
            column
            for column in (reader.fieldnames or [])
            if column and ("GC_ISS-T" in column or "FLT_ISS-T" in column)
        ]
        counts_by_ensembl = {row[""].strip('"'): row for row in reader}

    group = np.array([0 if "GC_ISS-T" in column else 1 for column in sample_columns])

    def values(symbol: str) -> np.ndarray:
        ensembl = de_by_symbol[symbol]["ENSEMBL"].strip('"')
        return np.array(
            [float(counts_by_ensembl[ensembl][column]) for column in sample_columns],
            dtype=float,
        )

    detected = [
        symbol
        for symbol in symbols
        if symbol in de_by_symbol
        and de_by_symbol[symbol].get(lfc_col) not in ("", "NA", None)
    ]
    selected = [
        symbol
        for symbol in detected
        if float(de_by_symbol[symbol][lfc_col]) > 0
        and float(de_by_symbol[symbol][fdr_col]) < 0.05
    ]
    wee1 = values("Wee1")
    selected_score = np.vstack([values(symbol) for symbol in selected]).mean(axis=0)

    pooled = correlation("Selected-26 pooled", wee1, selected_score)
    gc = correlation("Selected-26 ground control", wee1[group == 0], selected_score[group == 0])
    flight = correlation("Selected-26 flight", wee1[group == 1], selected_score[group == 1])

    rank_x = stats.rankdata(wee1)
    rank_y = stats.rankdata(selected_score)
    design = np.column_stack([np.ones(len(group)), group])
    residual_x = rank_x - design @ np.linalg.lstsq(design, rank_x, rcond=None)[0]
    residual_y = rank_y - design @ np.linalg.lstsq(design, rank_y, rcond=None)[0]
    partial_result = stats.pearsonr(residual_x, residual_y)
    partial = (float(partial_result.statistic), float(partial_result.pvalue))
    print(f"Selected-26 partial Spearman controlling group: r={partial[0]:+.6f}, p={partial[1]:.6f}")

    full_matrix = np.vstack([np.log2(values(symbol) + 1) for symbol in detected])
    full_z = (full_matrix - full_matrix.mean(axis=1, keepdims=True)) / full_matrix.std(
        axis=1, ddof=1, keepdims=True
    )
    full_score = full_z.mean(axis=0)
    full_pooled = correlation("Full-106 z-score pooled", wee1, full_score)
    rank_full = stats.rankdata(full_score)
    residual_full = rank_full - design @ np.linalg.lstsq(design, rank_full, rcond=None)[0]
    full_partial_result = stats.pearsonr(residual_x, residual_full)
    full_partial = (float(full_partial_result.statistic), float(full_partial_result.pvalue))
    print(f"Full-106 partial Spearman controlling group: r={full_partial[0]:+.6f}, p={full_partial[1]:.6f}")

    expected = [
        (pooled, (-0.630547, 0.005025)),
        (gc, (0.216667, 0.575515)),
        (flight, (0.433333, 0.243952)),
        (partial, (0.222738, 0.374330)),
        (full_pooled, (-0.481940, 0.042836)),
        (full_partial, (0.392517, 0.107138)),
    ]
    if len(detected) != 106 or len(selected) != 26:
        raise SystemExit(f"Unexpected gene counts: detected={len(detected)}, selected={len(selected)}")
    if any(not np.allclose(actual, target, atol=1e-5) for actual, target in expected):
        raise SystemExit("Association values differ from the manuscript")
    print("PASS: all Paper U Wee1–G2M association values reproduced.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())