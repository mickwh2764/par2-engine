"""Tests for the par2 command-line interface."""

import csv
import os
import sys

import numpy as np
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from par2.cli import main

EXAMPLE_CSV = os.path.join(os.path.dirname(__file__), "..", "data", "example_circadian.csv")


def run_cli(monkeypatch, *args):
    monkeypatch.setattr(sys, "argv", ["par2", *args])
    main()


def make_input(tmp_path, n_genes=3, n_timepoints=12, delimiter=","):
    t = np.arange(n_timepoints)
    path = tmp_path / "expr.csv"
    lines = [delimiter.join(["Gene"] + [f"T{i}" for i in t])]
    for g in range(n_genes):
        values = np.cos(2 * np.pi * t / (6 + g)) + 0.01 * g
        lines.append(delimiter.join([f"gene{g}"] + [f"{v:.4f}" for v in values]))
    path.write_text("\n".join(lines) + "\n")
    return str(path)


def test_cli_writes_output_file(monkeypatch, tmp_path):
    out = tmp_path / "results.csv"
    run_cli(monkeypatch, make_input(tmp_path), "-o", str(out))

    with open(out) as f:
        rows = list(csv.DictReader(f))
    assert len(rows) == 3
    assert set(rows[0]) >= {"gene", "eigenvalue", "phi1", "phi2", "r2", "root_type"}
    eigenvalues = [float(r["eigenvalue"]) for r in rows]
    assert eigenvalues == sorted(eigenvalues, reverse=True)


def test_cli_top_limits_rows(monkeypatch, tmp_path):
    out = tmp_path / "results.csv"
    run_cli(monkeypatch, make_input(tmp_path, n_genes=5), "-o", str(out), "--top", "2")
    assert len(out.read_text().strip().splitlines()) == 3  # header + 2 genes


def test_cli_writes_to_stdout_by_default(monkeypatch, tmp_path, capfd):
    run_cli(monkeypatch, make_input(tmp_path, n_genes=2))
    stdout, stderr = capfd.readouterr()
    assert stdout.splitlines()[0].startswith("gene,eigenvalue")
    assert "Loaded 2 genes x 12 timepoints" in stderr


def test_cli_custom_delimiter(monkeypatch, tmp_path):
    out = tmp_path / "results.csv"
    src = make_input(tmp_path, n_genes=2, delimiter="\t")
    run_cli(monkeypatch, src, "-o", str(out), "--delimiter", "\t")
    assert len(out.read_text().strip().splitlines()) == 3


def test_cli_missing_file_exits_nonzero(monkeypatch, tmp_path, capfd):
    with pytest.raises(SystemExit) as exc:
        run_cli(monkeypatch, str(tmp_path / "nope.csv"))
    assert exc.value.code == 1
    assert "file not found" in capfd.readouterr().err


def test_cli_on_bundled_example_dataset(monkeypatch, tmp_path):
    out = tmp_path / "results.csv"
    run_cli(monkeypatch, EXAMPLE_CSV, "-o", str(out))
    with open(out) as f:
        rows = list(csv.DictReader(f))
    assert len(rows) == 30
