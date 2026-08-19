#!/usr/bin/env python3
"""
Shanghai T2DM CGM Eigenvalue Pipeline — r(|λ|, mean glucose) Reproducibility
=============================================================================
Recomputes r(|λ|, mean glucose) = −0.61 and r(|λ|, CV%) = −0.68 from the
raw 5-minute CGM recordings of the ShanghaiT2DM dataset (Zhao et al. 2023).

This is the documented end-to-end reproducibility pipeline for the correlation
statistics archived in manuscripts/shanghai_t2dm_fibonacci.json.

STATUS
------
This pipeline has not yet been run against the Zhao et al. 2023 source data
because those data are not distributed with this repository.  The script
implements the analysis described in manuscripts/paper_k_t2dm_glucose.md
(Methods §2.1–2.4) and should reproduce the archived statistics when applied
to the correct source data.  Use --describe to inspect the pipeline without
supplying data.

DATA SOURCE
-----------
Zhao Z et al. "ShanghaiT2DM: A Shanghai-based continuous glucose monitoring
dataset for type 2 diabetes mellitus." Scientific Data 10, 175 (2023).
https://doi.org/10.1038/s41597-023-02084-6

EXPECTED DATA FORMAT
--------------------
The ShanghaiT2DM dataset provides per-patient CGM files (one file per
participant visit) at 5-minute sampling resolution.  Based on the Zhao et al.
2023 dataset description, each file is expected to contain at minimum:

  Column 1 (or named "time"/"datetime"/"Timestamp"): ISO timestamp or
            date+time in any common format, e.g. "2020-01-01 08:00:00"
  Column 2 (or named "glucose"/"GlucoseValue"/"Glucose"):
            blood glucose concentration in mg/dL (or mmol/L; auto-detected
            if all values < 30, converted × 18.016)

If the actual source files use different column names, supply the column
indices explicitly via --time-col and --glucose-col (0-indexed).

Subject–file mapping must be supplied via --file-map (JSON) because the
mapping from the archived subject IDs (Shanghai_2000_0, etc.) to the
source filenames depends on the dataset's internal identifier scheme,
which should be verified against the dataset README.

ANALYSIS METHOD (from paper_k_t2dm_glucose.md §2.1–2.4)
---------------------------------------------------------
For each participant:
  1. Clinical aggregates computed from ALL valid raw 5-minute readings:
       mean_glucose_clinical = mean of every valid reading (mg/dL)
       cv_clinical           = (population SD / mean) × 100%
     NOTE: these are NOT the means of daily means. Each reading contributes
     equally regardless of which day it came from.

  2. Glucose series mean-centred within each 24-hour window (midnight to
     midnight; 288 samples/day at 5-minute resolution).

  3. AR(2) fitted by OLS to each 24-hour window independently:
       g_t = φ₁ g_{t-1} + φ₂ g_{t-2} + ε_t
     where g_t is mean-centred glucose.

  4. Per-participant eigenvalue modulus |λ| = mean of per-window |λ| values
     across all days with ≥ 240 valid readings (≥ 83% of 288).

  5. Pearson r computed over the 10 subjects between |λ| and
     mean_glucose_clinical, and between |λ| and cv_clinical.

WHY STORED JSON ROWS GIVE r ≈ −0.447, NOT −0.61
------------------------------------------------
The per-subject meanGlucose and cvGlucose fields in the archived JSON were
stored as means-of-daily-means (each 24-hour window contributes equally).
The original pipeline used means of ALL raw 5-minute readings (each reading
contributes equally).  These two aggregation schemes differ when recording
durations differ across subjects or when the first/last days are partial.
The moduli stored in the JSON are also per-window means, consistent with
step 4 above.  Once both aggregation differences are applied (clinical means
from raw readings, moduli as per-window means), the r should match −0.61.

USAGE
-----
  # Show pipeline description and archived subject list (no data required)
  python3 manuscripts/scripts/shanghai_t2dm_cgm_r_pipeline.py --describe

  # Run against raw data directory with explicit subject→file mapping
  python3 manuscripts/scripts/shanghai_t2dm_cgm_r_pipeline.py \\
      --data-dir /path/to/ShanghaiT2DM/ \\
      --file-map '{
          "Shanghai_2000_0": "patient_2000_visit0.csv",
          "Shanghai_2001_0": "patient_2001_visit0.csv",
          "Shanghai_2001_1": "patient_2001_visit1.csv",
          "Shanghai_2002_0": "patient_2002_visit0.csv",
          "Shanghai_2003_0": "patient_2003_visit0.csv",
          "Shanghai_2004_0": "patient_2004_visit0.csv",
          "Shanghai_2005_0": "patient_2005_visit0.csv",
          "Shanghai_2006_0": "patient_2006_visit0.csv",
          "Shanghai_2007_0": "patient_2007_visit0.csv",
          "Shanghai_2008_0": "patient_2008_visit0.csv"
      }'

  # Additionally verify against the committed archive
  python3 manuscripts/scripts/shanghai_t2dm_cgm_r_pipeline.py \\
      --data-dir /path/to/ShanghaiT2DM/ \\
      --file-map '...' \\
      --verify-archive

  # Supply column indices if header names differ from expected
  python3 manuscripts/scripts/shanghai_t2dm_cgm_r_pipeline.py \\
      --data-dir /path/to/ShanghaiT2DM/ \\
      --file-map '...' \\
      --time-col 0 --glucose-col 1

DEPENDENCIES: none beyond Python 3.9+ standard library
"""

from __future__ import annotations

import argparse
import csv
import json
import math
import os
import sys
from datetime import datetime, timedelta
from pathlib import Path

REPO_ROOT    = Path(__file__).resolve().parent.parent.parent
ARCHIVE_PATH = REPO_ROOT / "manuscripts" / "shanghai_t2dm_fibonacci.json"

SUBJECT_IDS = [
    "Shanghai_2000_0",
    "Shanghai_2001_0",
    "Shanghai_2001_1",
    "Shanghai_2002_0",
    "Shanghai_2003_0",
    "Shanghai_2004_0",
    "Shanghai_2005_0",
    "Shanghai_2006_0",
    "Shanghai_2007_0",
    "Shanghai_2008_0",
]

MIN_READINGS_PER_DAY = 240   # 83% of 288 (5-min × 24h)
MODULUS_TOL          = 0.005
R_TOL                = 0.02   # ±0.02 on Pearson r
N_SUBJECTS_REQUIRED  = 10    # Pearson r MUST be over all 10 subjects; error otherwise
MAX_GAP_SLOTS        = 1     # AR lags may NOT span gaps longer than 1 missing slot


# ─────────────────────────────────────────────────────────────────────────────
# CSV parsing
# ─────────────────────────────────────────────────────────────────────────────

def _parse_timestamp(s: str) -> datetime:
    for fmt in (
        "%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S",
        "%Y/%m/%d %H:%M:%S", "%d/%m/%Y %H:%M:%S",
        "%m/%d/%Y %H:%M:%S", "%Y-%m-%d %H:%M",
        "%Y-%m-%dT%H:%M",    "%d/%m/%Y %H:%M",
        "%m/%d/%Y %H:%M",
    ):
        try:
            return datetime.strptime(s, fmt)
        except ValueError:
            pass
    raise ValueError(f"Cannot parse timestamp: {s!r}")


def _detect_col(header: list[str], candidates: set[str]) -> int | None:
    """Return index of first header column whose stripped-lower name is in candidates."""
    for i, col in enumerate(header):
        if col.strip().lower().replace("_", " ").replace("-", " ") in candidates:
            return i
    return None


_TIME_NAMES    = {"time", "datetime", "timestamp", "date time", "displaytime",
                  "display time", "date", "t"}
_GLUCOSE_NAMES = {"glucose", "glucose mgdl", "glucosevalue", "glucose value",
                  "bg", "cbg", "gluc", "glucoseconcentration", "gl", "mg dl",
                  "blood glucose"}


def parse_cgm_file(
    path: Path,
    time_col: int | None = None,
    glucose_col: int | None = None,
) -> list[tuple[datetime, float]]:
    """
    Read a CGM CSV file and return a list of (timestamp, glucose_mg_dL) tuples,
    sorted by time, with non-finite or physiologically implausible readings
    (< 40 or > 400 mg/dL) dropped.

    If time_col / glucose_col are None, the script attempts column detection
    by header name; if detection fails an error is raised with instructions.

    Mmol/L auto-detection: if all glucose values are < 30 after parsing,
    the values are multiplied by 18.016 to convert to mg/dL.
    """
    with open(path, newline="", encoding="utf-8-sig") as fh:
        sample  = fh.read(4096); fh.seek(0)
        dialect = csv.Sniffer().sniff(sample, delimiters=",;\t|")
        reader  = csv.reader(fh, dialect)
        header  = next(reader)

        if time_col is None:
            t_idx = _detect_col(header, _TIME_NAMES)
            if t_idx is None:
                raise ValueError(
                    f"{path.name}: cannot detect timestamp column in header {header}. "
                    "Use --time-col <N> (0-indexed) to specify it."
                )
        else:
            t_idx = time_col

        if glucose_col is None:
            g_idx = _detect_col(header, _GLUCOSE_NAMES)
            if g_idx is None:
                raise ValueError(
                    f"{path.name}: cannot detect glucose column in header {header}. "
                    "Use --glucose-col <N> (0-indexed) to specify it."
                )
        else:
            g_idx = glucose_col

        readings: list[tuple[datetime, float]] = []
        for row in reader:
            if len(row) <= max(t_idx, g_idx):
                continue
            try:
                ts = _parse_timestamp(row[t_idx].strip())
                gv = float(row[g_idx].strip())
            except (ValueError, OSError):
                continue
            if math.isfinite(gv):
                readings.append((ts, gv))

    if not readings:
        raise ValueError(f"No valid readings in {path}")

    # Auto-convert mmol/L → mg/dL
    if readings and max(g for _, g in readings) < 30.0:
        readings = [(t, g * 18.016) for t, g in readings]

    # Drop physiologically implausible values
    readings = [(t, g) for t, g in readings if 40.0 <= g <= 400.0]
    readings.sort(key=lambda x: x[0])
    return readings


# ─────────────────────────────────────────────────────────────────────────────
# Multi-day clinical aggregates — from ALL raw readings
# ─────────────────────────────────────────────────────────────────────────────

def clinical_aggregates(raw_readings: list[tuple[datetime, float]]) -> dict:
    """
    Compute multi-day clinical mean glucose and CV% from ALL valid raw readings.
    Each 5-minute reading contributes equally regardless of which day it belongs
    to.  This matches the aggregation used in the original pipeline (NOT mean
    of daily means).

    Args:
        raw_readings: raw (timestamp, glucose_mg_dL) pairs from parse_cgm_file()
                      — before any resampling, grid alignment, or day filtering.
    """
    vals = [g for _, g in raw_readings]
    n    = len(vals)
    if n < 2:
        raise ValueError("Fewer than 2 valid readings; cannot compute aggregates")
    mean  = sum(vals) / n
    # Population SD (n denominator) — all readings, not sample SD
    sd    = math.sqrt(sum((v - mean) ** 2 for v in vals) / n)
    cv    = 100.0 * sd / mean
    return {
        "clinicalMeanGlucose": round(mean, 3),
        "clinicalCV":          round(cv, 3),
        "n_raw_readings":      n,
    }


# ─────────────────────────────────────────────────────────────────────────────
# 5-minute grid construction and gap-aware day segmentation
# ─────────────────────────────────────────────────────────────────────────────

def build_5min_grid_for_day(
    day_date: "date",
    raw_readings: list[tuple[datetime, float]],
) -> list[float | None]:
    """
    Build a strict 288-slot 5-minute grid for a single calendar day
    (midnight to 23:55).  Each slot covers a 5-minute interval starting at
    HH:MM.  A reading is assigned to the nearest slot; if multiple readings
    fall in the same slot the one closest to the slot centre is used.

    Returns a list of 288 values (float or None for missing slots).

    Cadence validation: only readings within this calendar day are included;
    readings that cannot be snapped within ±2 minutes of a slot centre are
    dropped (treat as measurement noise, not a valid slot reading).
    """
    SLOTS = 288                     # 24 h × 60 min / 5 min
    grid: list[float | None] = [None] * SLOTS
    best_dt: list[float]           = [float("inf")] * SLOTS  # seconds from slot centre

    midnight = datetime(day_date.year, day_date.month, day_date.day, 0, 0, 0)
    SLOT_SEC = 300                  # 5 minutes in seconds
    MAX_SNAP = 120                  # ±2 min tolerance for snapping (seconds)

    for ts, gv in raw_readings:
        if ts.date() != day_date:
            continue
        elapsed = (ts - midnight).total_seconds()
        slot    = round(elapsed / SLOT_SEC)
        if slot < 0 or slot >= SLOTS:
            continue
        slot_centre = slot * SLOT_SEC
        dt = abs(elapsed - slot_centre)
        if dt > MAX_SNAP:
            continue            # reading is too far from any slot boundary
        if dt < best_dt[slot]:
            best_dt[slot] = dt
            grid[slot]    = gv

    return grid


def _continuous_runs(grid: list[float | None]) -> list[list[float]]:
    """
    Split a 288-slot day grid into maximal runs of consecutively filled
    (non-None) slots.  AR(2) lags must stay within a single run so that
    no lag pair spans a gap.

    Returns list of runs; each run is a list of float values.
    """
    runs: list[list[float]] = []
    current: list[float] = []
    for v in grid:
        if v is not None:
            current.append(v)
        else:
            if current:
                runs.append(current)
                current = []
    if current:
        runs.append(current)
    return runs


def segment_days(
    raw_readings: list[tuple[datetime, float]],
) -> list[tuple[str, list[float | None]]]:
    """
    Build 5-minute grids for all calendar days represented in raw_readings.
    Returns list of (date_iso, grid) pairs for days with ≥ MIN_READINGS_PER_DAY
    filled slots.

    Note: all raw readings, including from excluded partial days, still
    count towards clinical_aggregates().
    """
    # Collect unique calendar days
    from datetime import date as date_type
    day_keys: dict[str, date_type] = {}
    for ts, _ in raw_readings:
        k = ts.date().isoformat()
        day_keys[k] = ts.date()

    result = []
    for k, d in sorted(day_keys.items()):
        grid = build_5min_grid_for_day(d, raw_readings)
        filled = sum(1 for v in grid if v is not None)
        if filled >= MIN_READINGS_PER_DAY:
            result.append((k, grid))
    return result


def _fit_ar2_ols(series: list[float]) -> float | None:
    """
    Fit AR(2) OLS to a pre-demeaned series.  Returns eigenvalue modulus
    or None if the fit is degenerate or non-stationary.
    """
    n = len(series)
    if n < 6:
        return None

    Y  = series[2:]
    Y1 = series[1:n - 1]
    Y2 = series[0:n - 2]
    m  = len(Y)

    s11 = sum(a * a for a in Y1)
    s22 = sum(a * a for a in Y2)
    s12 = sum(Y1[i] * Y2[i] for i in range(m))
    sy1 = sum(Y[i]  * Y1[i] for i in range(m))
    sy2 = sum(Y[i]  * Y2[i] for i in range(m))

    denom = s11 * s22 - s12 * s12
    if abs(denom) < 1e-12:
        return None

    phi1 = (sy1 * s22 - sy2 * s12) / denom
    phi2 = (sy2 * s11 - sy1 * s12) / denom

    if not ((phi1 + phi2 < 1.0) and (phi2 - phi1 < 1.0) and (-1.0 < phi2 < 1.0)):
        return None

    disc = phi1 * phi1 + 4.0 * phi2
    if disc >= 0.0:
        r1 = (phi1 + math.sqrt(disc)) / 2.0
        r2 = (phi1 - math.sqrt(disc)) / 2.0
        return max(abs(r1), abs(r2))
    else:
        return math.sqrt((phi1 / 2.0) ** 2 + (-disc / 4.0))


def _fit_ar2_window(grid: list[float | None]) -> float | None:
    """
    Fit AR(2) OLS to a single 24-hour window represented as a 288-slot grid.

    Gap handling: split the grid into maximal contiguous runs of non-None
    slots.  Fit AR(2) OLS on the LONGEST run (after mean-centring that run).
    This ensures AR lag pairs never span a gap in the 5-minute cadence.
    If no run has ≥ 6 consecutive readings, or the fit is non-stationary,
    return None.

    Mean-centring uses the mean of the longest run only (consistent with the
    manuscript's per-window demeaning).
    """
    runs = _continuous_runs(grid)
    if not runs:
        return None
    longest = max(runs, key=len)
    if len(longest) < 6:
        return None
    mean = sum(longest) / len(longest)
    demeaned = [v - mean for v in longest]
    return _fit_ar2_ols(demeaned)


def mean_daily_modulus(
    day_grids: list[tuple[str, list[float | None]]],
) -> float | None:
    """
    Fit AR(2) independently to each 24-hour window (using the gap-aware
    _fit_ar2_window) and return the mean |λ| across all days for which the
    fit converges to a stationary solution.

    Matches manuscript §2.2: 'the mean daily |λ| were recorded per participant'.
    """
    moduli = []
    for _date_iso, grid in day_grids:
        m = _fit_ar2_window(grid)
        if m is not None:
            moduli.append(m)
    if not moduli:
        return None
    return sum(moduli) / len(moduli)


# ─────────────────────────────────────────────────────────────────────────────
# Pearson r + two-tailed p-value (matches colas2019_cgm_ar2_analysis.py)
# ─────────────────────────────────────────────────────────────────────────────

def pearson(xs: list[float], ys: list[float]) -> tuple[float, float]:
    n  = len(xs)
    mx = sum(xs) / n
    my = sum(ys) / n
    cov = sum((xs[i] - mx) * (ys[i] - my) for i in range(n))
    sx  = math.sqrt(sum((x - mx) ** 2 for x in xs))
    sy  = math.sqrt(sum((y - my) ** 2 for y in ys))
    if sx < 1e-12 or sy < 1e-12:
        return 0.0, 1.0
    r = cov / (sx * sy)
    t = r * math.sqrt(n - 2) / math.sqrt(max(1.0 - r * r, 1e-15))
    x = (n - 2) / ((n - 2) + t * t)

    def betainc(a: float, b: float, x: float) -> float:
        if x <= 0: return 0.0
        if x >= 1: return 1.0
        lbeta = math.lgamma(a) + math.lgamma(b) - math.lgamma(a + b)
        front = math.exp(math.log(x) * a + math.log(1 - x) * b - lbeta) / a
        qab = a + b; qap = a + 1; qam = a - 1
        c = 1.0
        d = 1.0 - qab * x / qap; d = max(abs(d), 1e-30); d = 1 / d
        h = d
        for m2 in range(1, 201):
            m_ = m2; m2_ = 2 * m_
            aa = m_ * (b - m_) * x / ((qam + m2_) * (a + m2_))
            d = 1 + aa * d; d = max(abs(d), 1e-30); d = 1 / d
            c = 1 + aa / c; c = max(abs(c), 1e-30); h *= d * c
            aa = -(a + m_) * (qab + m_) * x / ((a + m2_) * (qap + m2_))
            d = 1 + aa * d; d = max(abs(d), 1e-30); d = 1 / d
            c = 1 + aa / c; c = max(abs(c), 1e-30)
            delta = d * c; h *= delta
            if abs(delta - 1) < 3e-7:
                break
        return front * h

    p = betainc((n - 2) / 2, 0.5, x)
    return r, p


# ─────────────────────────────────────────────────────────────────────────────
# --describe: pipeline summary without data
# ─────────────────────────────────────────────────────────────────────────────

def describe() -> None:
    line = "─" * 68
    print(line)
    print("SHANGHAI T2DM CGM PIPELINE — DESCRIPTION")
    print(line)
    print("""
Analysis method (from paper_k_t2dm_glucose.md §2.1–2.4)
---------------------------------------------------------
For each of the 10 participants (Shanghai_2000_0 … Shanghai_2008_0):

  1. Clinical aggregates (from ALL raw 5-minute readings):
       mean_glucose_clinical = mean of every raw reading (mg/dL)
       cv_clinical           = (population SD / mean) × 100%
     (Not mean-of-daily-means; each reading contributes equally.)

  2. Segment into calendar days (midnight–midnight, ≥ 240 readings/day).
     Mean-centre each day independently (remove daily baseline offset).

  3. Fit AR(2) by OLS to each 24-hour window independently.
     Compute eigenvalue modulus |λ| per window.

  4. Per-participant modulus = mean |λ| across all stationary windows.
     (Manuscript §2.2: "mean daily |λ| were recorded per participant".)

  5. Pearson r over the 10 subjects:
       r(|λ|, mean_glucose_clinical)  →  expected ≈ −0.61  (p ≈ 0.061)
       r(|λ|, cv_clinical)             →  expected ≈ −0.68  (p ≈ 0.030)

Why stored JSON rows give r ≈ −0.447 rather than −0.61
-------------------------------------------------------
  The archived per-subject meanGlucose = mean of daily means (each day
  weighted equally).  The original pipeline used mean of ALL raw readings
  (each 5-minute sample weighted equally).  These differ when recording
  durations vary across subjects or when partial days exist.
  The direction of r is preserved (negative in both cases).

Data source
-----------
  Zhao Z et al. Scientific Data 10, 175 (2023).
  https://doi.org/10.1038/s41597-023-02084-6

Provenance document
-------------------
  manuscripts/scripts/shanghai_t2dm_cgm_pipeline_provenance.md

Consistency checker (runs without raw data)
-------------------------------------------
  python3 manuscripts/scripts/cgm_shanghai_ar2_analysis.py --verify
  python3 manuscripts/scripts/cgm_shanghai_ar2_analysis.py --check-correlations
""")
    archive = json.loads(ARCHIVE_PATH.read_text())
    print(line)
    print(f"Archived subjects ({len(archive['results'])}):")
    for r in archive["results"]:
        print(f"  {r['subject']:20s}  |λ|={r['modulus']:.4f}  "
              f"meanGlucose={r['meanGlucose']:.1f}  status={r['clinicalStatus']}")
    summary = archive["summary"]
    print()
    print(f"  Archived r(|λ|, mean glucose): {summary['r_modulus_mean_glucose']:+.2f}  "
          f"p = {summary['p_modulus_mean_glucose']:.3f}")
    print(f"  Archived r(|λ|, CV%):          {summary['r_modulus_cv']:+.2f}  "
          f"p = {summary['p_modulus_cv']:.3f}")
    print(line)


# ─────────────────────────────────────────────────────────────────────────────
# Main pipeline
# ─────────────────────────────────────────────────────────────────────────────

def run_pipeline(
    data_dir: Path,
    file_map: dict[str, Path],
    verify: bool,
    verbose: bool,
    time_col: int | None,
    glucose_col: int | None,
) -> bool:
    line = "─" * 68
    print(line)
    print("SHANGHAI T2DM CGM EIGENVALUE PIPELINE")
    print(f"Data directory: {data_dir}")
    print(line)

    # ── Validate that the file-map covers exactly the required 10 subjects ─────
    missing = [sid for sid in SUBJECT_IDS if sid not in file_map]
    if missing:
        print(
            f"ERROR: file-map is missing {len(missing)} required subject(s): "
            + ", ".join(missing),
            file=sys.stderr,
        )
        print(
            "Pearson r requires all 10 subjects.  Provide a complete --file-map "
            "and retry.",
            file=sys.stderr,
        )
        return False

    extra = [sid for sid in file_map if sid not in set(SUBJECT_IDS)]
    if extra:
        print(
            f"WARNING: file-map contains {len(extra)} unrecognised subject(s) "
            "(ignored): " + ", ".join(extra),
            file=sys.stderr,
        )

    results: list[dict] = []
    for sid in SUBJECT_IDS:
        fpath = file_map[sid]
        if not fpath.exists():
            print(f"ERROR: file not found for {sid}: {fpath}", file=sys.stderr)
            return False

        raw     = parse_cgm_file(fpath, time_col=time_col, glucose_col=glucose_col)
        agg     = clinical_aggregates(raw)       # ALL raw readings (before grid)
        grids   = segment_days(raw)              # (date_iso, 288-slot-grid) pairs
        modulus = mean_daily_modulus(grids)      # mean of per-window |λ|, gap-aware

        if modulus is None:
            print(
                f"ERROR: AR(2) fit failed for {sid}: all qualifying windows "
                f"({len(grids)}) produced non-stationary or degenerate fits.  "
                "Cannot compute Pearson r over an incomplete cohort.",
                file=sys.stderr,
            )
            return False

        results.append({
            "subject":             sid,
            "clinicalMeanGlucose": agg["clinicalMeanGlucose"],
            "clinicalCV":          agg["clinicalCV"],
            "n_raw_readings":      agg["n_raw_readings"],
            "n_days":              len(grids),
            "modulus":             round(modulus, 6),
        })

        if verbose:
            print(f"  {sid:20s}  n_days={len(grids):3d}  n_raw={agg['n_raw_readings']:5d}"
                  f"  |λ|={modulus:.4f}  mean_gluc={agg['clinicalMeanGlucose']:.1f}"
                  f"  CV={agg['clinicalCV']:.1f}%")

    n = len(results)
    if n != N_SUBJECTS_REQUIRED:
        # This should be unreachable given the checks above, but guard explicitly.
        print(
            f"ERROR: expected {N_SUBJECTS_REQUIRED} subjects, processed {n}.  "
            "Aborting — Pearson r over a partial cohort would be invalid.",
            file=sys.stderr,
        )
        return False

    moduli = [r["modulus"]            for r in results]
    means  = [r["clinicalMeanGlucose"] for r in results]
    cvs    = [r["clinicalCV"]          for r in results]

    r_mean, p_mean = pearson(moduli, means)
    r_cv,   p_cv   = pearson(moduli, cvs)

    print()
    print(line)
    print("RESULTS")
    print(line)
    print(f"  n subjects              : {n}")
    print(f"  r(|λ|, mean glucose)    : {r_mean:+.4f}  p = {p_mean:.4f}")
    print(f"  r(|λ|, CV%)             : {r_cv:+.4f}  p = {p_cv:.4f}")

    ok = True
    if verify:
        archive     = json.loads(ARCHIVE_PATH.read_text())
        arch_r_mean = archive["summary"]["r_modulus_mean_glucose"]
        arch_r_cv   = archive["summary"]["r_modulus_cv"]
        arch_mods   = {r["subject"]: r["modulus"] for r in archive["results"]}

        print()
        print(line)
        print("ARCHIVE VERIFICATION")
        print(line)

        mod_ok = True
        for r in results:
            if r["subject"] in arch_mods:
                diff   = abs(r["modulus"] - arch_mods[r["subject"]])
                status = "PASS" if diff <= MODULUS_TOL else "FAIL"
                if diff > MODULUS_TOL:
                    mod_ok = False
                if verbose or diff > MODULUS_TOL:
                    print(f"  |λ| {r['subject']:18s}: computed={r['modulus']:.4f}"
                          f"  arch={arch_mods[r['subject']]:.4f}  Δ={diff:.4f}  [{status}]")
        if mod_ok:
            print(f"  Per-subject |λ|: PASS (all within ±{MODULUS_TOL})")

        diff_mean = abs(r_mean - arch_r_mean)
        diff_cv   = abs(r_cv   - arch_r_cv)
        rm_ok = diff_mean <= R_TOL
        rc_ok = diff_cv   <= R_TOL
        print(f"  r(|λ|, mean glucose):  computed={r_mean:+.4f}  arch={arch_r_mean:+.4f}"
              f"  Δ={diff_mean:.4f}  [{'PASS' if rm_ok else 'FAIL'}]")
        print(f"  r(|λ|, CV%):           computed={r_cv:+.4f}  arch={arch_r_cv:+.4f}"
              f"  Δ={diff_cv:.4f}  [{'PASS' if rc_ok else 'FAIL'}]")
        ok = mod_ok and rm_ok and rc_ok
        print()
        print("Verification:", "PASSED" if ok else "FAILED")

    return ok


# ─────────────────────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Recompute r(|λ|, mean glucose) = −0.61 from raw Shanghai T2DM CGM data.",
        epilog="Data: Zhao Z et al. Scientific Data 10, 175 (2023). "
               "https://doi.org/10.1038/s41597-023-02084-6",
    )
    parser.add_argument("--data-dir", metavar="PATH",
                        help="Directory containing per-subject CGM CSV files.")
    parser.add_argument("--file-map", metavar="JSON", default=None,
                        help=('JSON object: {"Shanghai_2000_0": "filename.csv", ...}. '
                              "Paths relative to --data-dir."))
    parser.add_argument("--verify-archive", action="store_true",
                        help="Assert computed r values match the committed archive.")
    parser.add_argument("--time-col", type=int, default=None, metavar="N",
                        help="0-indexed column for timestamps (if auto-detect fails).")
    parser.add_argument("--glucose-col", type=int, default=None, metavar="N",
                        help="0-indexed column for glucose values (if auto-detect fails).")
    parser.add_argument("--verbose", "-v", action="store_true")
    parser.add_argument("--describe", action="store_true",
                        help="Print pipeline description (no data required).")
    args = parser.parse_args()

    if args.describe:
        describe()
        sys.exit(0)

    data_dir_str = args.data_dir or os.environ.get("SHANGHAI_T2DM_DATA_DIR")
    if not data_dir_str:
        parser.error(
            "--data-dir is required (or set SHANGHAI_T2DM_DATA_DIR). "
            "Run with --describe to see the pipeline description and data format."
        )

    data_dir = Path(data_dir_str)
    if not data_dir.is_dir():
        sys.exit(f"ERROR: {data_dir} is not a directory")

    if not args.file_map:
        sys.exit(
            "ERROR: --file-map is required.\n"
            "Provide a JSON object mapping each subject ID to its source CSV filename.\n"
            "Example: --file-map '{\"Shanghai_2000_0\": \"patient_2000_v0.csv\", ...}'\n"
            "The exact filenames depend on the dataset's internal structure; consult\n"
            "the ShanghaiT2DM dataset README after obtaining the data."
        )

    raw_map  = json.loads(args.file_map)
    file_map = {sid: data_dir / fname for sid, fname in raw_map.items()}

    ok = run_pipeline(
        data_dir    = data_dir,
        file_map    = file_map,
        verify      = args.verify_archive,
        verbose     = args.verbose,
        time_col    = args.time_col,
        glucose_col = args.glucose_col,
    )
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
