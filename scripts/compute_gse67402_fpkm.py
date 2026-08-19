"""
Compute approximated Cuffdiff-style FPKM for GSE67402 E. coli starvation dataset.

Input:
  GSE67402_counts.csv.gz    — original 27-sample raw count matrix (from GEO)
  REL606_nc.gtf             — Wilke Lab REL606 genome annotation (exact GTF used in
                               the Cuffdiff pipeline; carries ECB_ gene IDs)

Both inputs are downloaded automatically if not present at /tmp/.

Output:
  datasets/GSE67402_Ecoli_starvation_FPKM.csv
      Columns: Gene, T3h, T4h, T5h, T6h, T8h, T24h, T48h, T168h, T336h
      Values: replicate-averaged FPKM per timepoint (see normalization note below)

NOTE — git-ignore: datasets/ is git-ignored (files are too large for version control).
Run this script to regenerate the FPKM file on a fresh checkout.

NORMALIZATION (Cuffdiff upper-quartile, documented in Roberts et al. 2011):
  1. For each sample s, compute the upper quartile (75th percentile of non-zero
     raw counts): UQ_s
  2. Compute geometric mean of UQ across all samples: geom_UQ
  3. Effective library size for sample s: eff_lib_s = total_reads_s × UQ_s / geom_UQ
  4. FPKM_g_s = (count_g_s × 10^9) / (gene_length_bp × eff_lib_s)
  5. Average FPKM across 3 replicates per timepoint

  This is the UQ scaling of per-sample library sizes, not a replacement of
  library size with UQ.  Resulting FPKM values are in a plausible range (1–10,000).

LIMITATION:
  Cuffdiff also uses a Beta-Negative-Binomial (BNB) model to pool reads across
  replicates, which regularises per-timepoint FPKM estimates and can raise
  autocorrelation relative to the per-replicate arithmetic mean used here.
  Exact reproduction requires the original BAM files and Cuffdiff binary, neither
  of which is deposited on GEO.  The GEO supplementary file
  (GSE67402_counts.csv.gz) is the only expression data publicly available.

Samples:
  Replicate 1: AG3C-16..24  (timepoints 3h,4h,5h,6h,8h,24h,48h,168h,336h)
  Replicate 2: AG3C-25..33
  Replicate 3: AG3C-97..105
  Excluded:    AG3C-97-ND..105-ND (rRNA-not-depleted, excluded per Methods text)

Usage:
  python3 scripts/compute_gse67402_fpkm.py
"""

import csv
import gzip
import math
import os
import re
import subprocess
import sys

GZ_COUNTS = os.environ.get("GSE67402_GZ", "/tmp/GSE67402_counts.csv.gz")
GTF_PATH  = "/tmp/REL606_nc.gtf"
OUT_PATH  = "datasets/GSE67402_Ecoli_starvation_FPKM.csv"

TIMEPOINTS = [3, 4, 5, 6, 8, 24, 48, 168, 336]
REP1_IDS   = [f"AG3C-{i}" for i in range(16, 25)]
REP2_IDS   = [f"AG3C-{i}" for i in range(25, 34)]
REP3_IDS   = [f"AG3C-{i}" for i in range(97, 106)]
LAMBDA_CAP = 0.999

# GTF URL is pinned to a specific commit to make the download reproducible.
# Commit 5d34b6fe921ed8b085808b2bb92e1a61b1a5776f ("Correcting reference_seqs
# organization") is the last commit that touched this file.
# SHA-256 of the GTF file: 9d9c79eaf476dc6407d484eab25b4afae159dc82235d722782997a24901b1059
GTF_COMMIT  = "5d34b6fe921ed8b085808b2bb92e1a61b1a5776f"
GTF_SHA256  = "9d9c79eaf476dc6407d484eab25b4afae159dc82235d722782997a24901b1059"

GEO_URL = ("https://ftp.ncbi.nlm.nih.gov/geo/series/GSE67nnn/GSE67402/suppl/"
           "GSE67402_counts.csv.gz")
GTF_URL = (f"https://raw.githubusercontent.com/wilkelab/AG3C_starvation_tc_RNAseq"
           f"/{GTF_COMMIT}/reference_seqs/final_reference_seqs/REL606_nc.gtf")


# ── helpers ───────────────────────────────────────────────────────────────────

def sha256_of(path):
    import hashlib
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def maybe_download(url, dest, name, expected_sha256=None):
    """Download `url` to `dest` if not already present, then optionally verify SHA-256."""
    if not os.path.exists(dest):
        print(f"  Downloading {name}...")
        ret = subprocess.call(["curl", "-sL", url, "-o", dest])
        if ret != 0 or not os.path.exists(dest):
            print(f"  ERROR: could not download {name} from {url}")
            sys.exit(1)
        print(f"  OK: {dest}")
    else:
        print(f"  Found cached: {dest}")

    if expected_sha256:
        actual = sha256_of(dest)
        if actual != expected_sha256:
            print(f"  ERROR: SHA-256 mismatch for {name}")
            print(f"    expected: {expected_sha256}")
            print(f"    actual:   {actual}")
            sys.exit(1)
        print(f"  SHA-256 verified: {actual[:16]}…")


def load_gene_lengths(gtf_path):
    """Gene length = end - start + 1 for each ECB_ gene feature in REL606_nc.gtf."""
    gene_lengths = {}
    with open(gtf_path) as fh:
        for line in fh:
            if line.startswith("#"):
                continue
            parts = line.rstrip("\n").split("\t")
            if len(parts) < 9 or parts[2] != "gene":
                continue
            start = int(parts[3])
            end   = int(parts[4])
            m = re.search(r'gene_id "([^"]+)"', parts[8])
            if m:
                gene_lengths[m.group(1)] = end - start + 1
    return gene_lengths


def upper_quartile(vals):
    """75th percentile of non-zero values (Cuffdiff UQ normalization factor)."""
    nonzero = sorted(v for v in vals if v > 0)
    if not nonzero:
        return 1.0
    return nonzero[int(len(nonzero) * 0.75)]


def fit_ar2(ts):
    """AR(2) dominant eigenvalue |λ|, uncapped (returns None for degenerate series)."""
    n = len(ts)
    if n < 5:
        return None
    mean = sum(ts) / n
    y = [v - mean for v in ts]
    s11 = s12 = s22 = s1r = s2r = 0.0
    for t in range(2, n):
        x1, x2 = y[t-1], y[t-2]
        s11 += x1*x1;  s12 += x1*x2;  s22 += x2*x2
        s1r += x1*y[t]; s2r += x2*y[t]
    det = s11*s22 - s12*s12
    if abs(det) < 1e-15:
        return None
    phi1 = (s22*s1r - s12*s2r) / det
    phi2 = (s11*s2r - s12*s1r) / det
    disc = phi1*phi1 + 4*phi2
    if disc >= 0:
        r1 = (phi1 + math.sqrt(disc)) / 2
        r2 = (phi1 - math.sqrt(disc)) / 2
        return max(abs(r1), abs(r2))
    else:
        return math.sqrt(max(-phi2, 0.0))


# ── main ──────────────────────────────────────────────────────────────────────

def compute_fpkm():
    print("=== GSE67402 FPKM computation (Cuffdiff UQ normalization) ===\n")

    maybe_download(GEO_URL, GZ_COUNTS, "GSE67402 raw counts")
    maybe_download(GTF_URL, GTF_PATH,  "Wilke Lab REL606_nc.gtf", expected_sha256=GTF_SHA256)

    # 1. Gene lengths
    print("Loading gene lengths from REL606_nc.gtf...")
    gene_lengths = load_gene_lengths(GTF_PATH)
    print(f"  Genes with known lengths: {len(gene_lengths)}")

    # 2. Column mapping
    with gzip.open(GZ_COUNTS, "rt", newline="") as fh:
        header = next(csv.reader(fh))
    col_map = {h: i for i, h in enumerate(header)}

    r1_idx = [col_map[s] for s in REP1_IDS if s in col_map]
    r2_idx = [col_map[s] for s in REP2_IDS if s in col_map]
    r3_idx = [col_map[s] for s in REP3_IDS if s in col_map]
    assert len(r1_idx) == 9 and len(r2_idx) == 9 and len(r3_idx) == 9, \
        f"Unexpected replicate column counts: {len(r1_idx)}, {len(r2_idx)}, {len(r3_idx)}"
    all_idx = r1_idx + r2_idx + r3_idx   # 27 samples

    # 3. Load raw counts for all 27 samples
    print("Loading raw counts...")
    all_counts = {}
    with gzip.open(GZ_COUNTS, "rt", newline="") as fh:
        reader = csv.reader(fh)
        next(reader)
        for row in reader:
            ecb = row[0]
            try:
                vals = [float(row[c]) for c in all_idx]
                all_counts[ecb] = vals
            except (ValueError, IndexError):
                pass
    print(f"  Genes loaded: {len(all_counts)}")

    # 4. Per-sample total mapped reads and upper-quartile normalization factors
    print("Computing library sizes and UQ normalization factors...")
    sample_cols = [[all_counts[g][k] for g in all_counts] for k in range(27)]
    lib_total   = [sum(col) for col in sample_cols]
    uq_per_s    = [upper_quartile(col) for col in sample_cols]

    # Geometric mean of UQ across all 27 samples
    geom_uq = math.exp(sum(math.log(u) for u in uq_per_s) / 27)

    # Effective library size: total_reads × (UQ / geom_UQ)
    # This scales each sample so libraries with higher UQ are treated as larger.
    eff_lib = [lib_total[k] * uq_per_s[k] / geom_uq for k in range(27)]

    print(f"  Geometric mean UQ: {geom_uq:.1f}")
    print(f"  Effective lib sizes (rep1): {[f'{eff_lib[k]:.0f}' for k in range(9)]}")

    # 5. Compute FPKM per gene per sample, then average across replicates
    print("Computing FPKM per gene...")
    out_header = ["Gene"] + [f"T{t}h" for t in TIMEPOINTS]
    rows_out   = []
    n_no_len   = 0

    for ecb, counts in all_counts.items():
        glen = gene_lengths.get(ecb)
        if glen is None or glen == 0:
            n_no_len += 1
            continue

        fpkm_per_s = []
        for k in range(27):
            el = eff_lib[k]
            fpkm = (counts[k] * 1e9) / (glen * el) if el > 0 else 0.0
            fpkm_per_s.append(fpkm)

        avg_fpkm = [
            (fpkm_per_s[i] + fpkm_per_s[9+i] + fpkm_per_s[18+i]) / 3.0
            for i in range(9)
        ]
        rows_out.append([ecb] + [f"{v:.6f}" for v in avg_fpkm])

    print(f"  Genes with FPKM: {len(rows_out)}  |  skipped (no length in GTF): {n_no_len}")

    # Sanity check: FPKM range
    sample_fpkm = [float(rows_out[0][i+1]) for i in range(9)] if rows_out else []
    if sample_fpkm:
        print(f"  FPKM sanity check (gene {rows_out[0][0]}): "
              f"min={min(sample_fpkm):.2f}, max={max(sample_fpkm):.2f}")

    # 6. Write output CSV
    os.makedirs("datasets", exist_ok=True)
    with open(OUT_PATH, "w", newline="") as fh:
        writer = csv.writer(fh)
        writer.writerow(out_header)
        writer.writerows(rows_out)
    print(f"\n  Written: {OUT_PATH}")

    # 7. AR(2) eigenvalue statistics (stationary subset only, |λ| < 1)
    print("\nRunning AR(2) on FPKM time series (stationary genes: |λ| < 1)...")
    lams_all  = []
    lams_stat = []

    for row in rows_out:
        try:
            vals = [float(v) for v in row[1:]]
        except ValueError:
            continue
        lam = fit_ar2(vals)
        if lam is None:
            continue
        lams_all.append(lam)
        if lam < 1.0:
            lams_stat.append(lam)

    n_all  = len(lams_all)
    n_stat = len(lams_stat)

    if lams_stat:
        s_sorted   = sorted(lams_stat)
        mean_lam   = sum(s_sorted) / len(s_sorted)
        median_lam = s_sorted[len(s_sorted) // 2]
        stat_rate  = n_stat / max(n_all, 1) * 100

        print(f"  AR(2) fits:          {n_all}")
        print(f"  Stationary (|λ|<1):  {n_stat}  ({stat_rate:.1f}%)")
        print(f"  Genome mean   |λ|  = {mean_lam:.4f}  (page claims: 0.7738)")
        print(f"  Genome median |λ|  = {median_lam:.4f}  (page claims: 0.7845)")
        print()
        print("  NOTE: Exact Cuffdiff FPKM cannot be reproduced from GEO count data")
        print("  alone.  The original BAM files and Cuffdiff binary are required but")
        print("  are not deposited on GEO.  This file is the best available FPKM")
        print("  approximation; eigenvalue statistics remain PARTIAL in the audit log.")
    else:
        print("  No stationary fits — check input data")

    return len(rows_out), lams_stat


if __name__ == "__main__":
    compute_fpkm()
