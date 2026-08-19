"""
Prepare GSE232040 per-time-bin expression matrix from RAW.tar.

Downloads GSE232040_RAW.tar (111 MB) from NCBI GEO if not present,
processes all 384-well plate files, and aggregates mean UMI/cell
per (cell_type, treatment_arm, time_bin, gene).

Outputs:
  datasets/GSE232040_GBM_ZmanSeq_expression_per_timebin.csv
      Per-time-bin mean raw UMI/cell for IgG and aTrem2 treatment arms only
      (the two page-relevant arms; untreated/control plates not included).
      Columns: cell_type, arm, gene, 12H, 24H, 36H, 48H, Negative,
               n_12H, n_24H, n_36H, n_48H, n_Negative
      A special row with gene="__total_umi__" stores mean total raw UMI/cell
      per time bin (for downstream TP1K normalisation checks).

Also prints verification results for PERM_DIST and NULL_PCTILES
that are hardcoded in client/src/pages/gbm-zman-seq.tsx.

Usage:
  python3 scripts/prepare_gse232040_expression.py [--raw-tar /path/to/GSE232040_RAW.tar]
"""

import csv
import gzip
import io
import json
import math
import os
import random
import sys
import tarfile
from pathlib import Path

ROOT = Path(__file__).parent.parent

# ── Constants from gbm-zman-seq.tsx ──────────────────────────────────────────
TIME_BINS = ["12H", "24H", "36H", "48H", "Negative"]

# Hardcoded page values to verify
NK_DYS_IgG_RAW_PAGE = {
    "Clock":  [0.1148, 0.0204, 0.0122, 0.0142, 0.0063],
    "Gzmb":   [1.7377, 1.6735, 1.4817, 1.2954, 0.5375],
    "Gzma":   [5.9508, 5.4745, 5.0305, 5.3114, 3.5500],
    "Arg1":   [0.0656, 0.2194, 0.1616, 0.2580, 0.3937],
    "Havcr2": [0.0328, 0.0612, 0.0488, 0.0445, 0.0625],
    "Sell":   [0.5410, 0.3214, 0.3323, 0.2135, 0.2562],
    "Prf1":   [0.2623, 0.6173, 0.3018, 0.3737, 0.1187],
}
NK_DYS_IgG_N_PAGE = [61, 196, 328, 562, 160]

NK_DYS_ATREM2_RAW_PAGE = {
    "Clock": [0.0377, 0.0208, 0.0312, 0.0000, 0.0469],
    "Gzmb":  [0.7547, 1.0104, 0.8313, 0.5085, 0.2656],
    "Gzma":  [2.8868, 4.0208, 3.2563, 2.5932, 1.2188],
}
NK_DYS_ATREM2_N_PAGE = [53, 96, 160, 118, 64]

NK_CHEM_IgG_RAW_PAGE = {
    "Per1": [0.0180, 0.0000, 0.0286, 0.0206, 0.0833],
    "Gzmb": [1.2280, 0.7119, 1.1714, 1.1959, 0.3333],
    "Gzma": [5.3824, 4.5169, 5.1857, 5.1753, 3.5833],
}
NK_CHEM_IgG_N_PAGE = [557, 118, 70, 97, 12]

# PERM_DIST from page (120 permutations of gene labels)
PERM_DIST_PAGE = [
    ("-1.0", 1), ("-0.9", 4), ("-0.8", 3), ("-0.7", 6), ("-0.6", 7),
    ("-0.5", 6), ("-0.4", 4), ("-0.3", 10), ("-0.2", 6), ("-0.1", 10),
    ("0.0",  6), ("+0.1", 10), ("+0.2", 6), ("+0.3", 10), ("+0.4", 4),
    ("+0.5", 6), ("+0.6", 7), ("+0.7", 6), ("+0.8", 3), ("+0.9", 4),
    ("+1.0", 1),
]

# NULL_PCTILES from page (9094 expression-matched genes; 5th pctile ρ = −0.90)
NULL_PCTILES_PAGE = [
    ("5th",  -0.90), ("10th", -0.70), ("25th", -0.30),
    ("50th", +0.10), ("75th", +0.58), ("90th", +0.88), ("95th", +0.90),
]

# ── Spearman ρ ────────────────────────────────────────────────────────────────
def spearman(x, y):
    n = len(x)
    if n < 3:
        return float('nan')
    def rank(v):
        sv = sorted(range(n), key=lambda i: v[i])
        r = [0.0] * n
        i = 0
        while i < n:
            j = i
            while j < n - 1 and v[sv[j]] == v[sv[j+1]]:
                j += 1
            avg_rank = (i + j) / 2.0 + 1
            for k in range(i, j+1):
                r[sv[k]] = avg_rank
            i = j + 1
        return r
    rx = rank(x)
    ry = rank(y)
    mean_rx = sum(rx) / n
    mean_ry = sum(ry) / n
    num = sum((rx[i] - mean_rx) * (ry[i] - mean_ry) for i in range(n))
    dx = math.sqrt(sum((rx[i] - mean_rx)**2 for i in range(n)))
    dy = math.sqrt(sum((ry[i] - mean_ry)**2 for i in range(n)))
    if dx < 1e-12 or dy < 1e-12:
        return float('nan')
    return num / (dx * dy)

# ── Step 1: load plate → treatment arm mapping ────────────────────────────────
def load_series_matrix():
    matrix_gz = Path("/tmp/GSE232040_matrix.txt.gz")
    if not matrix_gz.exists():
        import urllib.request
        url = "https://ftp.ncbi.nlm.nih.gov/geo/series/GSE232nnn/GSE232040/matrix/GSE232040_series_matrix.txt.gz"
        print(f"  Downloading series matrix...")
        urllib.request.urlretrieve(url, matrix_gz)
    plate_treatment = {}
    with gzip.open(matrix_gz, 'rt') as f:
        titles = None
        for line in f:
            line = line.strip()
            if line.startswith('!Sample_title'):
                titles = [v.strip('"').split()[0] for v in line.split('\t')[1:]]
            elif 'treatment:' in line and titles and not plate_treatment:
                vals = [v.strip('"') for v in line.split('\t')[1:]]
                for t, v in zip(titles, vals):
                    plate_treatment[t] = v.split('treatment:')[1].strip() if 'treatment:' in v else 'unknown'
    return plate_treatment

# ── Step 2: build well → (arm, celltype, timebin) from full metadata ──────────
def build_well_metadata(plate_treatment):
    """
    Returns dict: Well_ID → {'arm': str, 'ct': str, 'tb': str}
    for IgG and aTrem2 treatment plates only.
    """
    igG_plates = {p for p, t in plate_treatment.items() if t == 'IgG'}
    atrem_plates = {p for p, t in plate_treatment.items() if t == 'aTrem2'}
    treatment_plates = igG_plates | atrem_plates

    well_meta = {}
    full_gz = Path("/tmp/GSE232040_meta_full.txt.gz")
    if not full_gz.exists():
        import urllib.request
        url = "https://ftp.ncbi.nlm.nih.gov/geo/series/GSE232nnn/GSE232040/suppl/GSE232040_metadata_q_annotated.txt.gz"
        print("  Downloading full metadata...")
        urllib.request.urlretrieve(url, full_gz)

    with gzip.open(full_gz, 'rt') as f:
        for i, line in enumerate(f):
            if i == 0:
                continue
            fields = line.strip().split()
            if len(fields) < 14:
                continue
            # Row layout for treatment plates (IgG/aTrem2):
            #   $1=row_num  $2=Well_ID  $3=well_coord  $4=Amp_batch_ID
            #   $11=Mouse  $12=mouse_num  $13=time_assignment  $14=celltype
            #   $NF=Treatment
            plate = fields[3]
            if plate not in treatment_plates:
                continue
            arm = 'IgG' if plate in igG_plates else 'aTrem2'
            well_id = fields[1]
            time = fields[12]  # time_assignment
            ct = fields[13]    # cell type
            # Only keep valid time bins
            if time not in ('12H', '24H', '36H', '48H', 'Negative'):
                continue
            well_meta[well_id] = {'arm': arm, 'ct': ct, 'tb': time, 'plate': plate}

    print(f"  Loaded metadata for {len(well_meta)} wells from IgG/aTrem2 plates")
    return well_meta

# ── Step 3: identify which plate files to process ────────────────────────────
def identify_needed_plates(well_meta, plate_treatment):
    """Get the set of plate IDs that have at least one well we care about."""
    needed = set()
    for w, m in well_meta.items():
        needed.add(m['plate'])
    return needed

# ── Step 4: read RAW.tar and accumulate per-cell expression ───────────────────
def process_raw_tar(raw_tar_path, well_meta, needed_plates):
    """
    Returns:
      per_cell: dict of (arm, ct, tb) → {gene: list_of_UMI_values}
      all_gene_names: ordered list of all gene names encountered
    """
    print(f"  Processing {raw_tar_path} ...")
    # Map plate files to plate IDs
    # File names: GSM7310702_AB5234.txt.gz → plate AB5234
    per_cell = {}  # (arm, ct, tb) → {gene: [umi1, umi2, ...]}
    total_umi = {}  # (arm, ct, tb) → [total_umi_per_cell]
    all_genes_set = set()
    all_genes_order = []

    with tarfile.open(raw_tar_path, 'r') as tar:
        members = tar.getmembers()
        # Build plate_id → member map
        plate_to_member = {}
        for m in members:
            # GSM7310702_AB5234.txt.gz
            fname = m.name
            parts = fname.replace('.txt.gz', '').split('_')
            if len(parts) >= 2:
                plate_id = parts[-1]
                plate_to_member[plate_id] = m

        plates_processed = 0
        for plate_id, member in plate_to_member.items():
            if plate_id not in needed_plates:
                continue

            plates_processed += 1
            if plates_processed % 5 == 0:
                print(f"    Processed {plates_processed}/{len(needed_plates)} plates...")

            # Extract and decompress the plate file
            f = tar.extractfile(member)
            if f is None:
                continue
            raw_bytes = f.read()
            with gzip.open(io.BytesIO(raw_bytes), 'rt') as gz:
                # First line: tab-separated well IDs
                header = gz.readline().rstrip('\n').split('\t')
                well_ids = header  # col indices 0..N-1 correspond to wells

                # Build index of wells we care about for this plate
                well_idx = {}  # idx → (arm, ct, tb)
                for idx, w in enumerate(well_ids):
                    if w in well_meta:
                        meta = well_meta[w]
                        well_idx[idx] = (meta['arm'], meta['ct'], meta['tb'])

                if not well_idx:
                    continue

                # Accumulate per-cell total UMI and per-gene UMI
                # well_totals[idx] = running sum of UMI across all genes for well idx
                well_totals = {idx: 0 for idx in well_idx}

                # Read gene rows
                for line in gz:
                    line = line.rstrip('\n')
                    tab_pos = line.find('\t')
                    if tab_pos < 0:
                        continue
                    gene = line[:tab_pos]
                    counts_str = line[tab_pos+1:].split('\t')

                    # Track gene order
                    if gene not in all_genes_set:
                        all_genes_set.add(gene)
                        all_genes_order.append(gene)

                    for idx, key in well_idx.items():
                        if idx < len(counts_str):
                            try:
                                umi = int(counts_str[idx])
                            except ValueError:
                                umi = 0
                            if umi > 0:
                                per_cell.setdefault(key, {}).setdefault(gene, []).append(umi)
                                well_totals[idx] += umi

                # Record per-cell total UMI
                for idx, key in well_idx.items():
                    total_umi.setdefault(key, []).append(well_totals[idx])

    print(f"  Processed {plates_processed} plates, {len(all_genes_order)} unique genes")
    return per_cell, total_umi, all_genes_order

# ── Step 5: compute per-timebin means ─────────────────────────────────────────
def compute_means(per_cell, total_umi, well_meta, all_genes):
    """
    Compute mean UMI/cell per (arm, ct, tb, gene).
    Denominator = total number of cells in that (arm, ct, tb) group.
    Also computes mean total UMI per cell per group (for TP1K normalization).
    """
    # Count cells per group
    cell_counts = {}  # (arm, ct, tb) → int
    for w, m in well_meta.items():
        key = (m['arm'], m['ct'], m['tb'])
        cell_counts[key] = cell_counts.get(key, 0) + 1

    # Compute means
    means = {}  # (arm, ct, tb) → {gene: mean_umi}
    for key, gene_lists in per_cell.items():
        n = cell_counts.get(key, 0)
        if n == 0:
            continue
        gene_means = {}
        for gene, umis in gene_lists.items():
            gene_means[gene] = sum(umis) / n
        means[key] = gene_means

    # Compute mean total UMI per cell per group (for TP1K normalization)
    mean_total_umi = {}  # (arm, ct, tb) → mean total UMI per cell
    for key, totals in total_umi.items():
        n = cell_counts.get(key, 0)
        if n == 0:
            continue
        # totals is a list of one value per cell (total UMI for that cell)
        mean_total_umi[key] = sum(totals) / n

    return means, cell_counts, mean_total_umi

# ── Step 6: write per-timebin CSV ─────────────────────────────────────────────
def write_csv(means, cell_counts, mean_total_umi, all_genes):
    """Write datasets/GSE232040_GBM_ZmanSeq_expression_per_timebin.csv

    Format:
      cell_type, arm, gene, 12H, 24H, 36H, 48H, Negative,
                            n_12H, n_24H, n_36H, n_48H, n_Negative

    A special row with gene="__total_umi__" stores the mean total raw UMI per
    cell per time bin for each (cell_type, arm) group.  Dividing any gene's raw
    mean by __total_umi__ and multiplying by 1000 gives the TP1K-normalised
    mean (transcripts per 1,000 total UMI), which matches the page's expression
    values for highly-expressed genes (Gzma, Gzmb, etc.).
    """
    out_path = ROOT / "datasets" / "GSE232040_GBM_ZmanSeq_expression_per_timebin.csv"

    # Get all (arm, ct) pairs that have data
    arm_ct_pairs = sorted(set((arm, ct) for arm, ct, tb in means.keys()))

    rows = []
    header = ["cell_type", "arm", "gene"] + TIME_BINS + [f"n_{tb}" for tb in TIME_BINS]
    rows.append(header)

    for arm, ct in arm_ct_pairs:
        # ── __total_umi__ row first ───────────────────────────────────────────
        total_row = [ct, arm, "__total_umi__"]
        for tb in TIME_BINS:
            key = (arm, ct, tb)
            v = mean_total_umi.get(key, 0.0)
            total_row.append(f"{v:.2f}")
        for tb in TIME_BINS:
            key = (arm, ct, tb)
            total_row.append(str(cell_counts.get(key, 0)))
        rows.append(total_row)

        # ── Gene rows ─────────────────────────────────────────────────────────
        genes_in_group = set()
        for tb in TIME_BINS:
            key = (arm, ct, tb)
            if key in means:
                genes_in_group.update(means[key].keys())

        for gene in sorted(genes_in_group):
            row = [ct, arm, gene]
            for tb in TIME_BINS:
                key = (arm, ct, tb)
                if key in means and gene in means[key]:
                    row.append(f"{means[key][gene]:.4f}")
                else:
                    row.append("0.0000")
            for tb in TIME_BINS:
                key = (arm, ct, tb)
                row.append(str(cell_counts.get(key, 0)))
            rows.append(row)

    with open(out_path, 'w', newline='') as f:
        writer = csv.writer(f)
        writer.writerows(rows)

    n_data_rows = len(rows) - 1
    print(f"  Written: {out_path}  ({n_data_rows} gene×arm×celltype rows, "
          f"incl. __total_umi__ rows)")
    return out_path

# ── Step 7: verify hardcoded page values ──────────────────────────────────────
def verify_page_values(means, cell_counts):
    """
    Verify that the per-timebin means match the hardcoded page values.
    Returns dict with check results.
    """
    results = {}
    tol = 5e-3  # ±0.005 tolerance

    def check_series(label, arm, ct, gene, page_vals, n_page):
        computed = []
        computed_n = []
        for i, tb in enumerate(TIME_BINS):
            key = (arm, ct, tb)
            v = means.get(key, {}).get(gene, 0.0)
            computed.append(v)
            computed_n.append(cell_counts.get(key, 0))
        max_diff = max(abs(computed[i] - page_vals[i]) for i in range(len(TIME_BINS)))
        n_ok = all(computed_n[i] == n_page[i] for i in range(len(TIME_BINS)))
        status = "PASS" if max_diff <= tol else "FAIL"
        print(f"  [{status}] {label:<55} max_diff={max_diff:.5f}")
        if status == "FAIL":
            for i, tb in enumerate(TIME_BINS):
                diff = abs(computed[i] - page_vals[i])
                print(f"         {tb}: page={page_vals[i]:.4f} computed={computed[i]:.4f} diff={diff:.5f}")
        return status == "PASS"

    print("\n--- Verifying NK_Dysfunctional IgG ---")
    for gene, page_vals in NK_DYS_IgG_RAW_PAGE.items():
        r = check_series(f"NK_Dysfunctional IgG {gene}", "IgG", "NK_Dysfunctional",
                        gene, page_vals, NK_DYS_IgG_N_PAGE)
        results[f"NK_Dys_IgG_{gene}"] = r

    print("\n--- Verifying NK_Dysfunctional aTrem2 ---")
    for gene, page_vals in NK_DYS_ATREM2_RAW_PAGE.items():
        r = check_series(f"NK_Dysfunctional aTrem2 {gene}", "aTrem2", "NK_Dysfunctional",
                        gene, page_vals, NK_DYS_ATREM2_N_PAGE)
        results[f"NK_Dys_aTrem2_{gene}"] = r

    print("\n--- Verifying NK_Chemotactic IgG ---")
    for gene, page_vals in NK_CHEM_IgG_RAW_PAGE.items():
        r = check_series(f"NK_Chemotactic IgG {gene}", "IgG", "NK_Chemotactic",
                        gene, page_vals, NK_CHEM_IgG_N_PAGE)
        results[f"NK_Chem_IgG_{gene}"] = r

    return results

# ── Step 8: run permutation analysis ─────────────────────────────────────────
def run_permutation_analysis(means, cell_counts, n_perms=120, seed=42):
    """
    Run permutation test: shuffle gene labels in NK_Dysfunctional IgG,
    recompute Spearman ρ for Clock gene vs time, count how often |ρ| ≥ 0.90.

    Returns:
      observed_rho: float (ρ for Clock gene)
      perm_rhos: list of float (one per permutation)
      p_val: float (two-tailed proportion ≥ |observed_rho|)
    """
    print("\n--- Running permutation test ---")
    # Get the Clock gene mean UMI/cell across time bins for NK_Dysfunctional IgG
    ct = "NK_Dysfunctional"
    arm = "IgG"

    # Build per-gene × time-bin mean table
    # First get all genes that appear in NK_Dysfunctional IgG
    all_genes = set()
    for tb in TIME_BINS:
        key = (arm, ct, tb)
        if key in means:
            all_genes.update(means[key].keys())
    all_genes = sorted(all_genes)

    # Build mean UMI matrix: gene_idx → [12H, 24H, 36H, 48H, Negative]
    n_bins = len(TIME_BINS)
    gene_means = {}
    for gene in all_genes:
        vals = []
        for tb in TIME_BINS:
            key = (arm, ct, tb)
            v = means.get(key, {}).get(gene, 0.0)
            vals.append(v)
        gene_means[gene] = vals

    # Time bin index (rank): 12H=0, 24H=1, 36H=2, 48H=3, Negative=4
    time_ranks = list(range(n_bins))

    # Observed Spearman ρ for Clock
    clock_means = gene_means.get("Clock", [0.0]*n_bins)
    observed_rho = spearman(time_ranks, clock_means)
    print(f"  Observed Spearman ρ (Clock vs time): {observed_rho:.4f}")

    # Run permutations: shuffle gene labels, pick a random gene's time series
    # (permutation of gene labels = reassign which gene is "Clock")
    rng = random.Random(seed)
    perm_rhos = []
    gene_list = list(gene_means.values())  # list of [t0, t1, t2, t3, t4] per gene

    for _ in range(n_perms):
        # Pick a random gene's time series
        perm_series = rng.choice(gene_list)
        rho = spearman(time_ranks, perm_series)
        perm_rhos.append(rho)

    # Compute two-tailed p-value: proportion with |ρ| ≥ |observed_rho|
    n_extreme = sum(1 for r in perm_rhos if abs(r) >= abs(observed_rho) - 1e-9)
    p_val = n_extreme / n_perms
    print(f"  Permutation p-value (2-tailed, n={n_perms}): {p_val:.4f}")
    print(f"  Page claims p = 0.083, computed = {p_val:.4f}")

    # Build histogram (binned to 0.1 intervals)
    bins = {}
    for rho in perm_rhos:
        bin_key = round(round(rho * 10) / 10, 1)  # round to nearest 0.1
        bins[bin_key] = bins.get(bin_key, 0) + 1
    print(f"  Permutation histogram (page PERM_DIST total={sum(c for _, c in PERM_DIST_PAGE)}):")
    total = sum(bins.values())
    print(f"  Computed total = {total}, page total = {sum(c for _, c in PERM_DIST_PAGE)}")

    return observed_rho, perm_rhos, p_val

# ── Step 9: compute expression-matched null percentiles ───────────────────────
def compute_null_percentiles(means, cell_counts):
    """
    For each gene in NK_Dysfunctional IgG with mean expression within 5× of
    Clock mean expression, compute Spearman ρ vs time. Report percentiles.

    Page claims: 9,094 genes; 5th pctile = -0.90.
    """
    print("\n--- Computing expression-matched null percentiles ---")
    ct = "NK_Dysfunctional"
    arm = "IgG"
    time_ranks = list(range(len(TIME_BINS)))

    # Get Clock mean expression (average across all time bins)
    clock_means = []
    for tb in TIME_BINS:
        key = (arm, ct, tb)
        v = means.get(key, {}).get("Clock", 0.0)
        clock_means.append(v)
    clock_avg = sum(clock_means) / len(clock_means)
    print(f"  Clock mean expression (avg across bins): {clock_avg:.4f}")

    # Get all genes and compute Spearman ρ for expression-matched genes
    all_genes = set()
    for tb in TIME_BINS:
        key = (arm, ct, tb)
        if key in means:
            all_genes.update(means[key].keys())

    rhos = []
    n_matched = 0
    for gene in sorted(all_genes):
        gene_vals = []
        for tb in TIME_BINS:
            key = (arm, ct, tb)
            v = means.get(key, {}).get(gene, 0.0)
            gene_vals.append(v)
        gene_avg = sum(gene_vals) / len(gene_vals)
        # Expression-matched: mean expression within 5× of Clock
        if clock_avg > 0 and (gene_avg / clock_avg) > 0.2 and (gene_avg / clock_avg) < 5.0:
            n_matched += 1
        elif clock_avg == 0 and gene_avg == 0:
            n_matched += 1
        else:
            continue
        rho = spearman(time_ranks, gene_vals)
        if not math.isnan(rho):
            rhos.append(rho)

    rhos_sorted = sorted(rhos)
    n = len(rhos_sorted)
    print(f"  Expression-matched genes: {n} (page claims 9,094)")

    def pctile(p):
        idx = int(n * p / 100)
        return rhos_sorted[min(idx, n-1)]

    print(f"  5th percentile:  {pctile(5):.4f}  (page: -0.90)")
    print(f"  10th percentile: {pctile(10):.4f}  (page: -0.70)")
    print(f"  25th percentile: {pctile(25):.4f}  (page: -0.30)")
    print(f"  50th percentile: {pctile(50):.4f}  (page: +0.10)")
    print(f"  75th percentile: {pctile(75):.4f}  (page: +0.58)")
    print(f"  90th percentile: {pctile(90):.4f}  (page: +0.88)")
    print(f"  95th percentile: {pctile(95):.4f}  (page: +0.90)")

    return rhos_sorted

# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument('--raw-tar', default='/tmp/GSE232040_RAW.tar',
                        help='Path to GSE232040_RAW.tar (downloaded from GEO)')
    parser.add_argument('--n-perms', type=int, default=120,
                        help='Number of permutations (default: 120)')
    parser.add_argument('--seed', type=int, default=42)
    args = parser.parse_args()

    raw_tar = Path(args.raw_tar)
    if not raw_tar.exists():
        import urllib.request
        url = "https://ftp.ncbi.nlm.nih.gov/geo/series/GSE232nnn/GSE232040/suppl/GSE232040_RAW.tar"
        print(f"Downloading GSE232040_RAW.tar from GEO (~111 MB)...")
        urllib.request.urlretrieve(url, raw_tar)
        print(f"  Downloaded to {raw_tar}")

    print("\n=== Step 1: Loading plate → treatment arm mapping ===")
    plate_treatment = load_series_matrix()
    igG_count = sum(1 for t in plate_treatment.values() if t == 'IgG')
    atrem_count = sum(1 for t in plate_treatment.values() if t == 'aTrem2')
    print(f"  IgG plates: {igG_count}, aTrem2 plates: {atrem_count}")

    print("\n=== Step 2: Loading well metadata for treatment plates ===")
    well_meta = build_well_metadata(plate_treatment)

    needed_plates = {m['plate'] for m in well_meta.values()}
    print(f"  Need to process {len(needed_plates)} plates")

    print("\n=== Step 3: Processing RAW.tar ===")
    per_cell, total_umi, all_genes = process_raw_tar(raw_tar, well_meta, needed_plates)

    print("\n=== Step 4: Computing per-timebin means ===")
    means, cell_counts, mean_total_umi = compute_means(per_cell, total_umi, well_meta, all_genes)

    # Print cell counts and total UMI summary
    for (arm, ct, tb), n in sorted(cell_counts.items()):
        if 'NK' in ct and n > 0:
            key = (arm, ct, tb)
            tot = mean_total_umi.get(key, 0)
            print(f"  {arm} {ct} {tb}: n={n}  mean_total_UMI={tot:.0f}")

    print("\n=== Step 5: Writing per-timebin CSV ===")
    out_path = write_csv(means, cell_counts, mean_total_umi, all_genes)

    print("\n=== Step 6: Verifying page expression values (raw vs page) ===")
    verify_results = verify_page_values(means, cell_counts)
    n_pass = sum(1 for v in verify_results.values() if v)
    n_fail = sum(1 for v in verify_results.values() if not v)
    print(f"\n  Expression verification (raw UMI vs page): {n_pass} PASS, {n_fail} FAIL")
    print("  NOTE: Discrepancies expected — page used TP1K-normalized expression.")

    print("\n=== Step 7: Permutation analysis (PERM_DIST verification) ===")
    obs_rho, perm_rhos, p_val = run_permutation_analysis(
        means, cell_counts, n_perms=args.n_perms, seed=args.seed)

    print("\n=== Step 8: Null percentile analysis (NULL_PCTILES verification) ===")
    null_rhos = compute_null_percentiles(means, cell_counts)

    print("\n=== SUMMARY ===")
    print(f"  Output CSV:     {out_path}")
    print(f"  Expression checks (raw): {n_pass}/{n_pass+n_fail} PASS")
    print(f"  Observed Clock ρ (raw):  {obs_rho:.4f}  (page: -0.90)")
    print(f"  Permutation p (raw):     {p_val:.4f}   (page: 0.083)")
    print(f"  Null gene count:         {len(null_rhos)}  (page: 9,094)")
    print()
    # Print TP1K-normalized values for a spot-check
    for tb_i, tb in enumerate(TIME_BINS):
        key = ("IgG", "NK_Dysfunctional", tb)
        tot = mean_total_umi.get(key, 0)
        gzma = means.get(key, {}).get("Gzma", 0.0)
        gzma_norm = 1000 * gzma / tot if tot > 0 else 0
        print(f"  NK_Dys IgG {tb}: mean_total_UMI={tot:.0f}, "
              f"Gzma_raw={gzma:.4f}, Gzma_TP1K={gzma_norm:.4f} (page: {NK_DYS_IgG_RAW_PAGE['Gzma'][tb_i]:.4f})")

if __name__ == '__main__':
    main()
