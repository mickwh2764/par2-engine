# GLDS-247 colon (RR-6) analysis code — Paper U

Analysis scripts for *Selective Suppression of PAR bZIP Circadian Output in Murine
Colon During Long-Duration Spaceflight* (NASA GeneLab **GLDS-247 / OSD-247**,
*Mus musculus* C57BL/6J, colon, RR-6).

## Inputs

Nothing in this directory is redistributed NASA data. Download the two input tables
from the OSDR record before running anything:

```bash
BASE="https://osdr.nasa.gov/geode-py/ws/studies/OSD-247/download?file="

# differential expression (version 1 — see "Data versions" below)
curl -L -o de_results.csv \
  "${BASE}GLDS-247_rna_seq_differential_expression_GLbulkRNAseq.csv&version=1"

# normalised counts (version 1), only needed by the Wee1–G2M check
curl -L -o norm_counts.csv \
  "${BASE}GLDS-247_rna_seq_Normalized_Counts_GLbulkRNAseq.csv&version=1"
```

## Running

`analyze_14genes.py` and `analyze_hallmark.py` read `datasets/GLDS247_colon_RR6/de_results.csv`
relative to the current working directory, so run them from the repository root:

```bash
python3 datasets/GLDS247_colon_RR6/analyze_14genes.py
python3 datasets/GLDS247_colon_RR6/analyze_hallmark.py

python3 datasets/GLDS247_colon_RR6/verification/check-glds247-live-table3.py \
  --de-file datasets/GLDS247_colon_RR6/de_results.csv
python3 datasets/GLDS247_colon_RR6/verification/check-glds247-wee1-g2m.py \
  --de-file datasets/GLDS247_colon_RR6/de_results.csv \
  --norm-counts datasets/GLDS247_colon_RR6/norm_counts.csv
```

Dependencies: Python ≥ 3.9, `scipy` (verified with 1.14.1), `numpy` for the Wee1–G2M check.
`check-glds247-live-table3.py` downloads the OSDR table itself when `--de-file` is omitted.

## Data versions

OSDR serves two versions of the differential-expression table and they are **not**
interchangeable for this paper:

| quantity | version 1 | version 2 |
|---|---|---|
| Hallmark clock genes detected | 38/38 | 36/38 (`Arntl`, `Arntl2` renamed `Bmal1`, `Bmal2`) |
| Hallmark FDR-significant | 16/38 | 15/36 |
| Hallmark direction | 29 DOWN / 9 UP, binomial p = 0.0008 | 28 DOWN / 8 UP, p = 0.0006 |
| 14-gene LAR arm | 7/14 DOWN, binomial p = 0.60 | 6/14 DOWN, p = 0.79 |
| Table 3 G2M counts | 81 UP / 25 DOWN, 27 FDR-significant | identical |

The manuscript values come from version 1. The scripts match on gene **symbol**
(`analyze_hallmark.py`) or Ensembl ID (`analyze_14genes.py`); only the symbol-matched
analysis is affected by the version-2 rename. The ISS-Terminal 14-gene results, the
PAR bZIP trio and Table 3 are identical under both versions.

`check-glds247-wee1-g2m.py` likewise reproduces its recorded constants against the
version-1 normalised counts. Version-2 counts leave the headline pooled association
unchanged (Spearman r = −0.631, p = 0.0050) but shift the full-106 sensitivity analysis
to r = −0.494, p = 0.037 (partial r = +0.359, p = 0.143); the direction and the
significance verdicts are unchanged.

## Provenance of these files

`analyze_14genes.py` and `analyze_hallmark.py` are published byte-identical to the
versions that produced the submitted results (git object
`b5ffb3ea2ee5b8a12ec8dcd5e97128b341f9b15b`, 2026-08-24). `SHA256SUMS.txt` records their
hashes.

The two scripts under `verification/` are identical to the working copies except that
`GENE_SET_SOURCE` now points at `verification/g2m_symbols.py` in this directory instead
of a manuscript-generation script outside it; `g2m_symbols.py` holds the same 108
HALLMARK_G2M_CHECKPOINT symbols, extracted verbatim. Their pre-edit hashes are recorded
in `SHA256SUMS.txt` for comparison.
