# GLDS-247 colon (RR-6) analysis code — Paper U

Analysis scripts for *Selective Suppression of PAR bZIP Circadian Output in Murine
Colon During Long-Duration Spaceflight* (NASA GeneLab **GLDS-247 / OSD-247**,
*Mus musculus* C57BL/6NTac, colon, RR-6).

## Inputs — use OSDR **version 1**

> The published results were computed from **version 1** of the OSDR tables.
> OSDR now serves version 2 by default, and `&version=1` is required to get the
> version the manuscript used. Omitting it changes the 38-gene panel counts (see
> "Data versions"). The manuscript Methods cite the accession without a version;
> this file is the authoritative pin.

Nothing in this directory is redistributed NASA data. Download the two input tables
from the OSDR record before running anything:

```bash
BASE="https://osdr.nasa.gov/geode-py/ws/studies/OSD-247/download?file="

# differential expression (version 1)
curl -L -o de_results.csv \
  "${BASE}GLDS-247_rna_seq_differential_expression_GLbulkRNAseq.csv&version=1"

# normalised counts (version 1), only needed by the Wee1–G2M check
curl -L -o norm_counts.csv \
  "${BASE}GLDS-247_rna_seq_Normalized_Counts_GLbulkRNAseq.csv&version=1"
```

Check you have the right bytes before running anything — OSDR serves these files
byte-identically on repeat download, so the hashes are stable:

```bash
sha256sum -c <<'EOF'
e4db208b2cc16d0285c3417d3e7ac348488bd4f3df3c838f8226b444d2aca54c  de_results.csv
77d88c234e4d05423dc504a887aaf32678f18ae87b75a22f4ad96c035b920eb0  norm_counts.csv
EOF
```

If `de_results.csv` hashes to
`50a457ae1fa2fc6204d9553cc52b45e61a08c2126d95aa164c93499d641067a6`
(or `norm_counts.csv` to `d56d5573bdbfa16d8be7d347df79f9e924bcad1adcf35da4796e72412b131fe4`)
you have version 2; re-download with `&version=1`. A quicker check on the DE table:
version 1 contains the symbols `Arntl`/`Arntl2`, version 2 renames them to
`Bmal1`/`Bmal2`.

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

`check-glds247-live-table3.py` downloads the OSDR table itself when `--de-file` is
omitted, and its built-in URL requests **version 2**. Table 3 is identical under both
versions, so the check passes either way, but pass `--de-file de_results.csv` if you want
it run against the pinned version-1 table.

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

The scripts are deliberately **not** patched to alias `Bmal1`/`Bmal2`: they are published
as the artefacts that produced the submitted results, with hashes recorded in
`SHA256SUMS.txt`. Pin the input version instead.

Running `analyze_hallmark.py` on version 1 reproduces the manuscript exactly:
38/38 genes detected, 16/38 FDR-significant, 29 DOWN / 9 UP, binomial p = 0.0008.
`analyze_14genes.py` gives the PAR bZIP trio at log₂FC −1.776 / −1.502 / −1.657
(all FDR-significant) and the LAR arm at 7/14 DOWN, Fisher p = 0.058, binomial p = 0.60.

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
