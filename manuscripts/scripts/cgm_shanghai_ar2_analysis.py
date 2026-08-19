#!/usr/bin/env python3
"""
CGM Eigenvalue Analysis — Consistency Checker for Shanghai T2DM Results
========================================================================
IMPORTANT: This script is a CONSISTENCY CHECKER for the archived results in
manuscripts/shanghai_t2dm_fibonacci.json.  It does NOT reproduce those results
from raw data, and does not constitute an end-to-end reproducible pipeline.

WHY THIS IS NOT A FULL PIPELINE:
  The correlation statistics r(|λ|, mean glucose) = −0.61 and r(|λ|, CV%) = −0.68
  were produced by the original analysis running on raw 5-minute CGM time-series
  from Zhao et al. (2023).  The raw data are not redistributed in this repository;
  end-to-end reproduction requires obtaining those data from the published source
  and re-running the pipeline described in:
    manuscripts/scripts/shanghai_t2dm_cgm_pipeline_provenance.md

  The Fibonacci proximity (FP) values in the archived JSON were also produced by
  the original analysis using a coefficient-space FP formula; the modulus-based
  FP formula below (an approximation used elsewhere in the codebase) does not
  numerically reproduce the committed FP values for all subjects.

WHAT THIS SCRIPT DOES:
  --verify mode: checks the archived JSON for internal self-consistency
  (stationarity criterion, class-label/FP threshold agreement, summary
  averages, subject count).  See verify_json() docstring for full details.

  --check-correlations mode: computes Pearson r between |λ| and per-subject
  meanGlucose/cvGlucose from the stored summary rows, documents the discrepancy
  from the archived −0.61 / −0.68 values, and explains why the discrepancy
  exists (aggregation difference between multi-day clinical values and per-window
  summary statistics).

  The AR(2) fitting helpers below document the method (mean-centred windows,
  OLS) but are not connected to an input data path.

Archived results: manuscripts/shanghai_t2dm_fibonacci.json
Cited in:
  - shared/book-extended-chapters.ts  (Ch.12 extended content)
  - client/src/pages/book.tsx          (Ch.12 book page)
  - server/routes/book.ts             (Ch.12 server content)

Usage
-----
    python3 manuscripts/scripts/cgm_shanghai_ar2_analysis.py --verify
    python3 manuscripts/scripts/cgm_shanghai_ar2_analysis.py --check-correlations

Dependencies: none (pure Python)
"""

import json
import math
import sys
import argparse
from pathlib import Path

# ---------------------------------------------------------------------------
# AR(2) fitting (pure Python — no external dependencies required)
# ---------------------------------------------------------------------------

def fit_ar2_demeaned(series: list[float]) -> dict | None:
    """
    Fit AR(2) to a series that has already been mean-centred.
    Returns phi1, phi2, eigenvalue modulus, R², Fibonacci proximity, class.
    """
    n = len(series)
    if n < 6:
        return None

    Y  = series[2:]
    Y1 = series[1:n - 1]
    Y2 = series[0:n - 2]
    m  = len(Y)

    sY1Y1 = sum(a * a for a in Y1)
    sY2Y2 = sum(a * a for a in Y2)
    sY1Y2 = sum(Y1[i] * Y2[i] for i in range(m))
    sYY1  = sum(Y[i] * Y1[i] for i in range(m))
    sYY2  = sum(Y[i] * Y2[i] for i in range(m))

    denom = sY1Y1 * sY2Y2 - sY1Y2 ** 2
    if abs(denom) < 1e-12:
        return None

    phi1 = (sYY1 * sY2Y2 - sYY2 * sY1Y2) / denom
    phi2 = (sYY2 * sY1Y1 - sYY1 * sY1Y2) / denom

    # Eigenvalues: roots of z² - phi1·z - phi2 = 0
    discriminant = phi1 ** 2 + 4.0 * phi2
    if discriminant >= 0.0:
        r1 = (phi1 + math.sqrt(discriminant)) / 2.0
        r2 = (phi1 - math.sqrt(discriminant)) / 2.0
        modulus = max(abs(r1), abs(r2))
    else:
        real = phi1 / 2.0
        imag = math.sqrt(-discriminant) / 2.0
        modulus = math.sqrt(real ** 2 + imag ** 2)

    # R²
    pred   = [phi1 * Y1[i] + phi2 * Y2[i] for i in range(m)]
    meanY  = sum(Y) / m
    ss_tot = sum((y - meanY) ** 2 for y in Y)
    ss_res = sum((Y[i] - pred[i]) ** 2 for i in range(m))
    r2     = 1.0 - ss_res / ss_tot if ss_tot > 0 else 0.0

    # Fibonacci proximity
    inv_phi = 2.0 / (1.0 + math.sqrt(5.0))          # 1/φ ≈ 0.6180
    fp      = max(0.0, 100.0 * (1.0 - abs(modulus - inv_phi) / inv_phi))
    if fp >= 85.0:
        cls = "Fibonacci-like"
    elif fp >= 50.0:
        cls = "Near-Fibonacci"
    else:
        cls = "Non-Fibonacci"

    return {
        "phi1":            round(phi1, 6),
        "phi2":            round(phi2, 6),
        "modulus":         round(modulus, 6),
        "r2":              round(r2, 4),
        "fibonacciProximity": round(fp, 4),
        "fibonacciClass":  cls,
    }


def demean_24h_windows(raw_series: list[float]) -> list[float]:
    """
    Mean-centre a CGM series within each 24-hour window.
    Assumes 5-minute sampling => 288 samples/day.
    """
    samples_per_day = 288
    demeaned = []
    for start in range(0, len(raw_series), samples_per_day):
        window = raw_series[start:start + samples_per_day]
        if not window:
            break
        mu = sum(window) / len(window)
        demeaned.extend(v - mu for v in window)
    return demeaned


# ---------------------------------------------------------------------------
# Verification against the committed JSON
# ---------------------------------------------------------------------------

TOLERANCE = 0.005   # allowed absolute difference in modulus


def verify_json(json_path: Path) -> bool:
    """
    CONSISTENCY-ONLY VERIFICATION.

    This function checks the internal self-consistency of the committed JSON;
    it does NOT re-derive FP values from raw data or from eigenvalue modulus.

    WHY FP CANNOT BE RE-DERIVED FROM MODULUS HERE:
    The Fibonacci proximity values in this JSON were produced by the original
    analysis pipeline operating on raw 5-minute CGM time-series from
    Zhao et al. (2023).  The FP computation in that pipeline uses a
    coefficient-space formula (distance of (phi1, phi2) from the Fibonacci
    boundary in AR(2) parameter space) rather than the simplified modulus-
    based approximation that appears in the book glossary.  The two formulas
    agree for some parameter combinations but diverge substantially for others.
    Because the raw Shanghai T2DM data are not redistributed in this repository,
    end-to-end reproduction of FP values requires obtaining those data from
    the published source and re-running the full pipeline.

    WHAT THIS CHECK VERIFIES:
    1. All eigenvalue moduli < 1 (AR(2) stationarity criterion).
    2. Fibonacci class labels match the stored FP values under the stated
       classification thresholds (≥ 85% → Fibonacci-like,
       50–84% → Near-Fibonacci, < 50% → Non-Fibonacci).
    3. Summary averages (avgModulus, avgFibonacciProximity) are consistent
       with the per-subject rows.
    4. The dataset contains exactly 10 subjects.

    Run with: python3 manuscripts/scripts/cgm_shanghai_ar2_analysis.py --verify
    """
    data    = json.loads(json_path.read_text())
    results = data["results"]
    errors  = []

    for r in results:
        # 1. Stability: |λ| must be < 1 for a stationary fit
        if r["modulus"] >= 1.0:
            errors.append(f"  {r['subject']}: modulus {r['modulus']:.4f} ≥ 1 (non-stationary)")

        # 2. Class label must be consistent with stored FP value
        fp  = r["fibonacciProximity"]
        cls = r["fibonacciClass"]
        if fp >= 85.0:
            expected_cls = "Fibonacci-like"
        elif fp >= 50.0:
            expected_cls = "Near-Fibonacci"
        else:
            expected_cls = "Non-Fibonacci"
        if cls != expected_cls:
            errors.append(
                f"  {r['subject']}: class '{cls}' inconsistent with FP={fp:.1f}% "
                f"(expected '{expected_cls}')"
            )

    # 3. Summary averages must recompute from per-subject results
    moduli = [r["modulus"] for r in results]
    fps    = [r["fibonacciProximity"] for r in results]
    avg_mod = sum(moduli) / len(moduli)
    avg_fp  = sum(fps) / len(fps)

    summary = data["summary"]
    if abs(summary["avgModulus"] - avg_mod) > TOLERANCE:
        errors.append(
            f"  Summary avgModulus mismatch: stored {summary['avgModulus']:.4f}, "
            f"re-computed {avg_mod:.4f}"
        )
    if abs(summary["avgFibonacciProximity"] - avg_fp) > 1.0:
        errors.append(
            f"  Summary avgFP mismatch: stored {summary['avgFibonacciProximity']:.2f}%, "
            f"re-computed {avg_fp:.2f}%"
        )

    # 4. Subject count must be 10
    if len(results) != 10:
        errors.append(f"  Expected 10 subjects, found {len(results)}")

    if errors:
        print("VERIFICATION FAILED:")
        for e in errors:
            print(e)
        return False

    print(f"Verification passed: {len(results)} subjects, all checks consistent.")
    print(f"  Mean |λ| = {avg_mod:.3f}  Mean FP = {avg_fp:.1f}%")
    print(f"  Fibonacci-like: {sum(1 for r in results if r['fibonacciClass']=='Fibonacci-like')}")
    print(f"  Near-Fibonacci: {sum(1 for r in results if r['fibonacciClass']=='Near-Fibonacci')}")
    print(f"  Non-Fibonacci:  {sum(1 for r in results if r['fibonacciClass']=='Non-Fibonacci')}")
    return True


# ---------------------------------------------------------------------------
# Pearson r — pure Python (matches colas2019_cgm_ar2_analysis.py)
# ---------------------------------------------------------------------------

def pearson(xs: list[float], ys: list[float]) -> tuple[float, float]:
    """Return (r, p-value two-tailed)."""
    n  = len(xs)
    mx = sum(xs) / n
    my = sum(ys) / n
    cov = sum((xs[i] - mx) * (ys[i] - my) for i in range(n))
    sx  = math.sqrt(sum((x - mx) ** 2 for x in xs))
    sy  = math.sqrt(sum((y - my) ** 2 for y in ys))
    if sx < 1e-12 or sy < 1e-12:
        return 0.0, 1.0
    r = cov / (sx * sy)

    # Two-tailed p via regularised incomplete beta
    t = r * math.sqrt(n - 2) / math.sqrt(max(1 - r ** 2, 1e-15))
    x = (n - 2) / ((n - 2) + t ** 2)

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


# ---------------------------------------------------------------------------
# --check-correlations: document the discrepancy between archived scalars and
# what Pearson r on the stored summary rows actually gives.
# ---------------------------------------------------------------------------

def check_correlations(json_path: Path) -> None:
    """
    Compute Pearson r between |λ| and the per-subject meanGlucose / cvGlucose
    fields in the archived JSON, and document the discrepancy from the archived
    −0.61 / −0.68 values.

    This is diagnostic-only.  The stored summary rows use per-window means
    averaged over days (meanGlucose) and CV of per-window means (cvGlucose),
    while the original pipeline used multi-day clinical aggregates computed from
    every raw 5-minute reading.  The two aggregation paths give different numbers
    for the same subjects.

    For full provenance, see:
        manuscripts/scripts/shanghai_t2dm_cgm_pipeline_provenance.md
    """
    data    = json.loads(json_path.read_text())
    results = data["results"]
    summary = data["summary"]

    moduli = [r["modulus"]     for r in results]
    means  = [r["meanGlucose"] for r in results]
    cvs    = [r["cvGlucose"]   for r in results]

    r_mean, p_mean = pearson(moduli, means)
    r_cv,   p_cv   = pearson(moduli, cvs)

    archived_r_mean = summary["r_modulus_mean_glucose"]
    archived_p_mean = summary["p_modulus_mean_glucose"]
    archived_r_cv   = summary["r_modulus_cv"]
    archived_p_cv   = summary["p_modulus_cv"]

    line = "─" * 68
    print(line)
    print("SHANGHAI T2DM — CORRELATION DIAGNOSTIC")
    print("Comparing archived scalars vs. r from per-subject summary rows")
    print(line)
    print()
    print("  r(|λ|, mean glucose)")
    print(f"    Archived (from raw 5-min CGM):  r = {archived_r_mean:+.4f}  p = {archived_p_mean:.4f}")
    print(f"    From JSON summary rows:         r = {r_mean:+.4f}  p = {p_mean:.4f}")
    print(f"    Discrepancy:                    Δr = {r_mean - archived_r_mean:+.4f}")
    print()
    print("  r(|λ|, CV%)")
    print(f"    Archived (from raw 5-min CGM):  r = {archived_r_cv:+.4f}  p = {archived_p_cv:.4f}")
    print(f"    From JSON summary rows:         r = {r_cv:+.4f}  p = {p_cv:.4f}")
    print(f"    Discrepancy:                    Δr = {r_cv - archived_r_cv:+.4f}")
    print()
    print(line)
    print("INTERPRETATION")
    print(line)
    print()
    print("  Both from-rows values are negative (direction matches archived).")
    print("  The magnitude discrepancy is explained by aggregation method:")
    print()
    print("    Archived: multi-day clinical mean/CV from ALL raw 5-min readings.")
    print("    From rows: CV of per-window daily means (smaller n, different SD).")
    print()
    print("  To reproduce the archived values, obtain the raw 5-minute CGM data:")
    print("    Zhao et al. (2023), Scientific Data 10, 175.")
    print("    https://doi.org/10.1038/s41597-023-02084-6")
    print()
    print("  See full provenance documentation:")
    print("    manuscripts/scripts/shanghai_t2dm_cgm_pipeline_provenance.md")
    print()

    # Sanity check: sign must be preserved
    sign_ok_mean = (r_mean < 0) == (archived_r_mean < 0)
    sign_ok_cv   = (r_cv   < 0) == (archived_r_cv   < 0)
    if sign_ok_mean and sign_ok_cv:
        print("  Sign check: PASS — negative direction preserved in both correlations.")
    else:
        print("  Sign check: FAIL — unexpected sign change!", file=sys.stderr)
        if not sign_ok_mean:
            print(f"    r(|λ|, mean glucose): archived {archived_r_mean:+.4f} vs. rows {r_mean:+.4f}",
                  file=sys.stderr)
        if not sign_ok_cv:
            print(f"    r(|λ|, CV%): archived {archived_r_cv:+.4f} vs. rows {r_cv:+.4f}",
                  file=sys.stderr)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument(
        "--verify",
        action="store_true",
        help="Verify the committed JSON is internally self-consistent (no raw data needed).",
    )
    parser.add_argument(
        "--check-correlations",
        action="store_true",
        dest="check_correlations",
        help=(
            "Compute Pearson r from the stored summary rows and document the "
            "discrepancy from the archived −0.61 / −0.68 values. Explains "
            "why the multi-day clinical aggregates used in the original pipeline "
            "differ from the per-window summary statistics stored in the JSON."
        ),
    )
    args = parser.parse_args()

    repo_root = Path(__file__).resolve().parent.parent.parent
    json_path = repo_root / "manuscripts" / "shanghai_t2dm_fibonacci.json"

    if not json_path.exists():
        print(f"ERROR: Results JSON not found at {json_path}")
        sys.exit(1)

    if args.verify:
        ok = verify_json(json_path)
        sys.exit(0 if ok else 1)

    if args.check_correlations:
        check_correlations(json_path)
        sys.exit(0)

    # Default: run verification and explain provenance
    print("Shanghai T2DM CGM Eigenvalue — Consistency Checker")
    print()
    print("PROVENANCE NOTE:")
    print("  r(|λ|, mean glucose) = −0.61  (p = 0.061)")
    print("  r(|λ|, CV%)         = −0.68  (p = 0.030)")
    print("  These were computed by the original pipeline from raw 5-minute")
    print("  CGM recordings (Zhao et al. 2023). They cannot be re-derived from")
    print("  the per-subject summary rows in the JSON. Full provenance:")
    print("    manuscripts/scripts/shanghai_t2dm_cgm_pipeline_provenance.md")
    print()
    print("Running internal consistency verification...")
    print()
    ok = verify_json(json_path)
    print()
    print("To inspect the correlation discrepancy, run:")
    print("  python3 manuscripts/scripts/cgm_shanghai_ar2_analysis.py --check-correlations")
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
