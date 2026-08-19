"""
Prepare source datasets for three pages that were UNVERIFIABLE in the August 2026
platform accuracy audit.

Reads from environment variables (set by download_missing_datasets.sh):
  GSE67402_GZ   — path to GSE67402_counts.csv.gz  (raw read counts)
  GSE221173_GZ  — path to GSE221173_MYC-ER_RNA-Seq_TPM_Circadian_U2OS.txt.gz
  GSE232040_GZ  — path to GSE232040_metadata_q27_annotated.txt.gz

Can also be called directly (reads from /tmp by default):
  python3 scripts/prepare_missing_datasets.py

Outputs (written to datasets/, which is gitignored per project convention):
  datasets/GSE67402_Ecoli_starvation_averaged.csv
      9-timepoint replicate-averaged raw read counts; 4,486 E. coli genes.
      Original analysis used Cuffdiff FPKM (not deposited on GEO); raw counts
      are included for gene-identity and qualitative verification.

  datasets/GSE221173_U2OS_Rep2_MYC-OFF.csv
  datasets/GSE221173_U2OS_Rep2_MYC-ON.csv
      Rep2 TPM for 25 timepoints (CT24–CT72 at 2-h intervals); rows keyed by
      Ensembl ID (first column), gene symbol in second column.  No deduplication
      of multi-symbol Ensembl IDs is performed.

  datasets/GSE232040_GBM_ZmanSeq_metadata.csv
      Per-cell annotations from the GEO metadata file: cell type, time group,
      treatment, organ, mouse ID.  Expression values require GSE232040_RAW.tar
      (111 MB, not downloaded) — all expression-dependent claims on
      gbm-zman-seq.tsx remain PARTIAL.
"""

import csv
import gzip
import os
import sys

# ── input paths ──────────────────────────────────────────────────────────────
GZ_67402   = os.environ.get("GSE67402_GZ",   "/tmp/GSE67402_counts.csv.gz")
GZ_221173  = os.environ.get("GSE221173_GZ",  "/tmp/GSE221173_tpm.txt.gz")
GZ_232040  = os.environ.get("GSE232040_GZ",  "/tmp/GSE232040_meta.txt.gz")


# ─── 1. GSE67402 — E. coli glucose starvation ────────────────────────────────

def process_gse67402():
    print("\n=== GSE67402 — E. coli starvation ===")
    if not os.path.exists(GZ_67402):
        print(f"  SKIP: {GZ_67402} not found — run download_missing_datasets.sh first")
        return False

    # Sample-ID → (timepoint_h, replicate) from GEO series matrix metadata.
    # AG3C-16..24  = rep1 (timepoints 3h,4h,5h,6h,8h,24h,48h,168h,336h)
    # AG3C-25..33  = rep2
    # AG3C-97..105 = rep3
    # AG3C-97-ND..105-ND = rRNA-not-depleted rep3 — EXCLUDED per Methods text
    rep1_ids = [f"AG3C-{i}" for i in range(16, 25)]
    rep2_ids = [f"AG3C-{i}" for i in range(25, 34)]
    rep3_ids = [f"AG3C-{i}" for i in range(97, 106)]
    timepoints = [3, 4, 5, 6, 8, 24, 48, 168, 336]

    with gzip.open(GZ_67402, "rt", newline="") as fh:
        header = next(csv.reader(fh))
    col = {h: i for i, h in enumerate(header)}

    def get_idx(ids):
        return [col[sid] for sid in ids if sid in col]

    r1 = get_idx(rep1_ids)
    r2 = get_idx(rep2_ids)
    r3 = get_idx(rep3_ids)
    assert len(r1) == 9 and len(r2) == 9 and len(r3) == 9, \
        f"Unexpected replicate column count: {len(r1)}, {len(r2)}, {len(r3)}"

    out_header = ["Gene"] + [f"T{t}h" for t in timepoints]
    rows = []
    with gzip.open(GZ_67402, "rt", newline="") as fh:
        reader = csv.reader(fh)
        next(reader)
        for row in reader:
            gene = row[0]
            try:
                vals_r1 = [float(row[i]) for i in r1]
                vals_r2 = [float(row[i]) for i in r2]
                vals_r3 = [float(row[i]) for i in r3]
                avg = [(vals_r1[i]+vals_r2[i]+vals_r3[i])/3.0 for i in range(9)]
                rows.append([gene] + [f"{v:.4f}" for v in avg])
            except (ValueError, IndexError):
                pass

    out = "datasets/GSE67402_Ecoli_starvation_averaged.csv"
    with open(out, "w", newline="") as fh:
        writer = csv.writer(fh)
        writer.writerow(out_header)
        writer.writerows(rows)

    print(f"  Written: {out}  ({len(rows)} genes × {len(timepoints)} timepoints)")
    print(f"  NOTE: Genome eigenvalue statistics require Cuffdiff FPKM output.")
    print(f"        Run  python3 scripts/compute_gse67402_fpkm.py  to compute a")
    print(f"        UQ-normalized FPKM approximation using the Wilke Lab REL606_nc.gtf.")
    print(f"        The UQ-FPKM approximation gives 4,234 stationary genes; the page")
    print(f"        claims 3,946. Eigenvalue stats also differ from page claims because")
    print(f"        exact Cuffdiff FPKM requires BAM files not deposited on GEO.")
    return True


# ─── 2. GSE221173 — U2OS MYC-ER RNA-seq ─────────────────────────────────────

def process_gse221173():
    print("\n=== GSE221173 — U2OS MYC-ER RNA-seq ===")
    if not os.path.exists(GZ_221173):
        print(f"  SKIP: {GZ_221173} not found — run download_missing_datasets.sh first")
        return False

    with gzip.open(GZ_221173, "rt", newline="") as fh:
        header = next(csv.reader(fh, delimiter="\t"))
    col = {h: i for i, h in enumerate(header)}

    # File column layout (0-indexed):
    #   0=GENEID, 1=SYMBOL,
    #   2-14  = Rep1 MYC-OFF  (13 timepoints CT24..CT72 at 4-h intervals)
    #   15-27 = Rep1 MYC-ON   (13 timepoints CT24..CT72 at 4-h intervals)
    #   28-52 = Rep2 MYC-OFF  (25 timepoints CT24..CT72 at 2-h intervals)
    #   53-77 = Rep2 MYC-ON   (25 timepoints CT24..CT72 at 2-h intervals)

    # Rep2 — 25 timepoints CT24..CT72 at 2-h intervals
    tp2_range   = list(range(24, 73, 2))
    off2_idx    = [col[f"U2OS_Rep2_MYC-OFF_{t}"] for t in tp2_range]
    on2_idx     = [col[f"U2OS_Rep2_MYC-ON_{t}"]  for t in tp2_range]

    # Rep1 — 13 timepoints CT24..CT72 at 4-h intervals
    tp1_range   = list(range(24, 73, 4))
    off1_idx    = [col[f"U2OS_Rep1_MYC-OFF_{t}"] for t in tp1_range]
    on1_idx     = [col[f"U2OS_Rep1_MYC-ON_{t}"]  for t in tp1_range]

    ensg_col    = col["GENEID"]
    sym_col     = col["SYMBOL"]

    off2_rows = []; on2_rows = []
    off1_rows = []; on1_rows = []

    with gzip.open(GZ_221173, "rt", newline="") as fh:
        reader = csv.reader(fh, delimiter="\t")
        next(reader)
        for row in reader:
            ensg = row[ensg_col].strip()
            sym  = row[sym_col].strip()
            if not ensg:
                continue
            try:
                off2_v = [float(row[c]) for c in off2_idx]
                on2_v  = [float(row[c]) for c in on2_idx]
                off1_v = [float(row[c]) for c in off1_idx]
                on1_v  = [float(row[c]) for c in on1_idx]
                stem = [ensg, sym]
                off2_rows.append(stem + [f"{v:.4f}" for v in off2_v])
                on2_rows.append( stem + [f"{v:.4f}" for v in on2_v])
                off1_rows.append(stem + [f"{v:.4f}" for v in off1_v])
                on1_rows.append( stem + [f"{v:.4f}" for v in on1_v])
            except (ValueError, IndexError):
                pass

    def write_csv(path, header_extra, timepoints, rows):
        hdr = ["EnsemblID", "Symbol"] + [f"CT{t}" for t in timepoints]
        with open(path, "w", newline="") as fh:
            w = csv.writer(fh)
            w.writerow(hdr)
            w.writerows(rows)
        print(f"  Written: {path}  ({len(rows)} Ensembl ID rows × {len(timepoints)} timepoints)")

    write_csv("datasets/GSE221173_U2OS_Rep2_MYC-OFF.csv", [], tp2_range, off2_rows)
    write_csv("datasets/GSE221173_U2OS_Rep2_MYC-ON.csv",  [], tp2_range, on2_rows)
    write_csv("datasets/GSE221173_U2OS_Rep1_MYC-OFF.csv", [], tp1_range, off1_rows)
    write_csv("datasets/GSE221173_U2OS_Rep1_MYC-ON.csv",  [], tp1_range, on1_rows)
    print(f"  Row key: Ensembl ID (column 1).  Gene symbol in column 2 (may duplicate).")
    return True


# ─── 3. GSE232040 — GBM Zman-seq (metadata only) ─────────────────────────────

def process_gse232040():
    """
    Writes per-cell annotations from GSE232040_metadata_q27_annotated.txt.gz.

    FILE SCHEMA NOTE: The header has 22 space-delimited fields. Data rows have
    23 fields because they include an extra unlabeled alphanumeric well-position
    field (like "A1", "D17") at column index 2 (0-indexed) which is absent from
    the header. All subsequent fields in a data row are offset by +1 relative to
    their header index. This parser accounts for that offset.

    TREATMENT ARM NOTE: The IgG vs αTrem2 antibody treatment assignment is NOT
    present in this metadata file. The metadata provides cell type, time group,
    organ, and mouse ID, but NOT which antibody arm each cell belongs to. The
    per-arm cell counts cited on gbm-zman-seq.tsx (n_12H=61, n_IgG=..., etc.)
    therefore CANNOT be verified from metadata alone.

    Expression values require GSE232040_RAW.tar (111 MB, not stored).
    """
    print("\n=== GSE232040 — GBM Zman-seq metadata ===")
    if not os.path.exists(GZ_232040):
        print(f"  SKIP: {GZ_232040} not found — run download_missing_datasets.sh first")
        return False

    out_path = "datasets/GSE232040_GBM_ZmanSeq_metadata.csv"
    written = 0

    # FILE SCHEMA NOTE (discovered by inspection):
    # The file has rows of two lengths:
    #   23-field rows: Gating is a single word ("APC")
    #   24-field rows: Gating is "time stamp" (two words, adding one token)
    # In all cases, the LAST 3 fields are: celltype time_group Stain
    # and Well_ID is always field 0.  Organ and Mouse are at -7 and -6
    # from the end respectively (confirmed by inspection of both row types).
    #
    # Treatment arm (IgG vs αTrem2) is NOT present in this metadata file.
    # The Stain column is "stained" / "nonstained" / NA (flow-cytometry stain),
    # not the antibody treatment.

    # Known expected values for validation
    EXPECTED_CELLTYPES = {"NK", "B", "Monocytes", "Macrophages", "DC", "CD4",
                          "CD8", "Neutrophils"}
    EXPECTED_TIMEGROUPS = {"Negative", "12H", "24H", "36H", "48H"}

    with gzip.open(GZ_232040, "rt") as fh_in, \
         open(out_path, "w", newline="") as fh_out:
        writer = csv.writer(fh_out)
        writer.writerow(["Well_ID", "Organ", "Mouse", "celltype", "time_group"])

        observed_celltypes = set()
        observed_timegroups = set()

        for lineno, line in enumerate(fh_in):
            if lineno == 0:     # skip header line
                continue
            f = line.rstrip("\n").split(" ")
            if len(f) < 23:
                continue        # skip malformed rows
            # End-anchored field extraction (robust to variable row length):
            #   f[-1]  = Stain, f[-2] = time_group, f[-3] = celltype
            #   f[-4]  = mc,    f[-5] = sc_y,        f[-6] = sc_x
            #   f[-7]  = Mouse, f[-8] = Organ
            well_id   = f[0]
            organ     = f[-8]
            mouse     = f[-7]
            celltype  = f[-3]
            time_group = f[-2]
            writer.writerow([well_id, organ, mouse, celltype, time_group])
            written += 1
            observed_celltypes.add(celltype)
            observed_timegroups.add(time_group)

    # Validate schema — confirm expected labels are present
    ct_ok = bool(observed_celltypes & EXPECTED_CELLTYPES)
    tg_ok = bool(observed_timegroups & EXPECTED_TIMEGROUPS)
    print(f"  Written: {out_path}  ({written} cell rows)")
    print(f"  Observed celltypes (sample): {sorted(observed_celltypes & EXPECTED_CELLTYPES)}")
    print(f"  Observed time_groups: {sorted(observed_timegroups & EXPECTED_TIMEGROUPS)}")
    print(f"  NK cells total: {sum(1 for ct in open(out_path).read().splitlines()[1:] if ct.split(',')[3]=='NK')}")
    print(f"  Schema validation — expected celltypes: {ct_ok}  expected time_groups: {tg_ok}")
    if not ct_ok or not tg_ok:
        print("  ERROR: expected labels not found — row-end extraction may be wrong")
        return False
    print(f"  NOTE: Treatment arm (IgG vs αTrem2) NOT in this file; per-arm counts are PARTIAL.")
    return True


if __name__ == "__main__":
    ok1 = process_gse67402()
    ok2 = process_gse221173()
    ok3 = process_gse232040()
    n_ok = sum([ok1, ok2, ok3])
    print(f"\n=== {n_ok}/3 datasets prepared ===")
    if n_ok < 3:
        sys.exit(1)
