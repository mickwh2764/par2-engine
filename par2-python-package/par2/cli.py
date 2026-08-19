"""Command-line interface for par2-circadian."""

import argparse
import sys
import os


def main():
    parser = argparse.ArgumentParser(
        prog="par2",
        description="AR(2) eigenvalue analysis for gene expression time series",
    )
    parser.add_argument("input", help="CSV file with genes as rows, timepoints as columns")
    parser.add_argument("-o", "--output", default=None, help="Output CSV path (default: stdout)")
    parser.add_argument("--gene-col", type=int, default=0, help="Column index for gene names (default: 0)")
    parser.add_argument("--skip-cols", type=int, default=1, help="Number of leading columns before expression data (default: 1)")
    parser.add_argument("--delimiter", default=",", help="Field delimiter (default: comma)")
    parser.add_argument("--top", type=int, default=None, help="Show only top N genes by eigenvalue")

    args = parser.parse_args()

    from .io import load_expression_matrix, save_results
    from .core import fit_ar2_batch

    if not os.path.isfile(args.input):
        print(f"Error: file not found: {args.input}", file=sys.stderr)
        sys.exit(1)

    matrix, gene_names = load_expression_matrix(
        args.input,
        gene_col=args.gene_col,
        skip_cols=args.skip_cols,
        delimiter=args.delimiter,
    )

    print(f"Loaded {len(gene_names)} genes x {matrix.shape[1]} timepoints", file=sys.stderr)

    results = fit_ar2_batch(matrix, gene_names)

    if args.top:
        results = results[: args.top]

    if args.output:
        save_results(results, args.output)
        print(f"Saved {len(results)} results to {args.output}", file=sys.stderr)
    else:
        save_results(results, "/dev/stdout")
