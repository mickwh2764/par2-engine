#!/usr/bin/env python3
"""Reproduce the GLDS-247 Table 3 G2M counts from NASA's live DE table.

The script uses only the Python standard library. By default it downloads the
versioned differential-expression table exposed by the OSDR OSD-247 record.
Pass --de-file to validate an already-downloaded copy without network access.
"""

from __future__ import annotations

import argparse
import ast
import csv
import math
import tempfile
import urllib.request
from pathlib import Path


GENE_SET_SOURCE = Path(__file__).resolve().parent / "g2m_symbols.py"
NASA_DE_URL = (
    "https://osdr.nasa.gov/geode-py/ws/studies/OSD-247/download"
    "?file=GLDS-247_rna_seq_differential_expression_GLbulkRNAseq.csv&version=2"
)
ISS_TERMINAL_ROOT = (
    "(Space Flight & ~60 day & On ISS & Carcass)"
    "v(Ground Control & ~60 day & On Earth & Carcass)"
)
LFC_COLUMN = f"Log2fc_{ISS_TERMINAL_ROOT}"
FDR_COLUMN = f"Adj.p.value_{ISS_TERMINAL_ROOT}"

EXPECTED = {
    "declared": 108,
    "detected": 106,
    "missing": {"Sgol1", "Sgol2"},
    "up": 81,
    "down": 25,
    "fdr_up": 26,
    "fdr_down": 1,
    "fdr_total": 27,
}


def extract_g2m_symbols(source: Path) -> set[str]:
    tree = ast.parse(source.read_text(encoding="utf-8"), filename=str(source))
    for node in tree.body:
        if not isinstance(node, ast.Assign):
            continue
        if any(isinstance(target, ast.Name) and target.id == "G2M_SYMBOLS" for target in node.targets):
            value = ast.literal_eval(node.value)
            if not isinstance(value, set) or not all(isinstance(item, str) for item in value):
                raise ValueError("G2M_SYMBOLS must be a set of gene-symbol strings")
            return value
    raise ValueError(f"G2M_SYMBOLS not found in {source}")


def download_de_table(destination: Path) -> None:
    request = urllib.request.Request(
        NASA_DE_URL,
        headers={"User-Agent": "PAR2-GLDS247-reproducibility-check/1.0"},
    )
    with urllib.request.urlopen(request, timeout=120) as response, destination.open("wb") as output:
        while chunk := response.read(1024 * 1024):
            output.write(chunk)


def finite_float(value: str | None) -> float | None:
    try:
        parsed = float(value) if value is not None else math.nan
    except (TypeError, ValueError):
        return None
    return parsed if math.isfinite(parsed) else None


def read_live_results(de_file: Path, symbols: set[str]) -> dict[str, tuple[float, float]]:
    results: dict[str, tuple[float, float]] = {}
    with de_file.open(newline="", encoding="utf-8-sig") as handle:
        reader = csv.DictReader(handle)
        required = {"SYMBOL", LFC_COLUMN, FDR_COLUMN}
        missing_columns = required.difference(reader.fieldnames or [])
        if missing_columns:
            raise ValueError(f"NASA DE table is missing columns: {sorted(missing_columns)}")

        for row in reader:
            symbol = (row.get("SYMBOL") or "").strip('"')
            if symbol not in symbols:
                continue
            lfc = finite_float(row.get(LFC_COLUMN))
            fdr = finite_float(row.get(FDR_COLUMN))
            if lfc is not None and fdr is not None:
                results[symbol] = (lfc, fdr)
    return results


def exact_one_sided_binomial(up: int, total: int) -> float:
    return sum(math.comb(total, k) for k in range(up, total + 1)) / (2**total)


def check_equal(label: str, actual: object, expected: object, failures: list[str]) -> None:
    if actual == expected:
        print(f"PASS  {label}: {actual}")
    else:
        failures.append(f"{label}: expected {expected!r}, got {actual!r}")
        print(f"FAIL  {label}: expected {expected!r}, got {actual!r}")


def validate(de_file: Path) -> int:
    symbols = extract_g2m_symbols(GENE_SET_SOURCE)
    results = read_live_results(de_file, symbols)
    missing = symbols.difference(results)

    up = sum(lfc > 0 for lfc, _ in results.values())
    down = sum(lfc < 0 for lfc, _ in results.values())
    fdr_up = sum(lfc > 0 and fdr < 0.05 for lfc, fdr in results.values())
    fdr_down = sum(lfc < 0 and fdr < 0.05 for lfc, fdr in results.values())
    binomial_p = exact_one_sided_binomial(up, len(results))

    failures: list[str] = []
    check_equal("declared G2M symbols", len(symbols), EXPECTED["declared"], failures)
    check_equal("detected genes with finite ISS-Terminal results", len(results), EXPECTED["detected"], failures)
    check_equal("symbols absent from the live DE table", missing, EXPECTED["missing"], failures)
    check_equal("directionally UP genes", up, EXPECTED["up"], failures)
    check_equal("directionally DOWN genes", down, EXPECTED["down"], failures)
    check_equal("FDR-significant UP genes", fdr_up, EXPECTED["fdr_up"], failures)
    check_equal("FDR-significant DOWN genes", fdr_down, EXPECTED["fdr_down"], failures)
    check_equal("FDR-significant genes in either direction", fdr_up + fdr_down, EXPECTED["fdr_total"], failures)

    print(f"INFO  exact one-sided binomial p: {binomial_p:.12g}")
    if not math.isclose(binomial_p, 2.2396872587839116e-08, rel_tol=1e-12):
        failures.append(f"binomial p changed: got {binomial_p:.12g}")
        print("FAIL  binomial p no longer reproduces 2.23968725878e-08")
    else:
        print("PASS  binomial p rounds to the manuscript value 2.2×10⁻⁸")

    if failures:
        print("\nGLDS-247 Table 3 live-data reproduction FAILED:")
        for failure in failures:
            print(f"  - {failure}")
        return 1

    print("\nGLDS-247 Table 3 live-data reproduction PASSED.")
    print(f"Source: {NASA_DE_URL}")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--de-file",
        type=Path,
        help="Use a local NASA differential-expression CSV instead of downloading version 2.",
    )
    args = parser.parse_args()

    if args.de_file:
        return validate(args.de_file)

    with tempfile.TemporaryDirectory(prefix="glds247-table3-") as temp_dir:
        de_file = Path(temp_dir) / "GLDS-247_live_de_v2.csv"
        print(f"Downloading live OSD-247 differential-expression table:\n  {NASA_DE_URL}")
        download_de_table(de_file)
        return validate(de_file)


if __name__ == "__main__":
    raise SystemExit(main())