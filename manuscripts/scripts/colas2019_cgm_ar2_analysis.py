#!/usr/bin/env python3
"""
CGM AR(2) Eigenvalue Analysis — Colas et al. (2019) Normoglycemic Cohort
=========================================================================
Computes AR(2) eigenvalue modulus for each participant in the Colas 2019
continuous glucose monitoring dataset (n = 18 normoglycemic adults), using
24-hour mean-centred hourly glucose profiles from:

  datasets/cgm_circadian_combined.csv  (dataset == "Colas2019")

Results are archived to:
  manuscripts/colas2019_cgm_ar2_results.json

Cited in:
  shared/book-extended-chapters.ts  (Ch.12 extended content)

Usage
-----
    python3 manuscripts/scripts/colas2019_cgm_ar2_analysis.py

Dependencies: none (pure Python 3.8+)

Source reference
----------------
Colas C et al. (2019). "Wrist-worn sensor for continuous measurement of blood
glucose dynamics." Multi-day continuous glucose monitoring recordings from
18 normoglycemic adult volunteers.
Note: the CSV stores 24-hour hourly means per participant.  CV% computed from
these means reflects intra-day (circadian) glucose variability rather than the
multi-day clinical CV% used in standard diabetes monitoring.
"""

import csv
import json
import math
import sys
from pathlib import Path

REPO_ROOT  = Path(__file__).resolve().parent.parent.parent
CSV_PATH   = REPO_ROOT / "datasets" / "cgm_circadian_combined.csv"
OUTPUT_PATH = REPO_ROOT / "manuscripts" / "colas2019_cgm_ar2_results.json"


# ---------------------------------------------------------------------------
# AR(2) fitting (pure Python, mean-centred OLS — matches pipeline elsewhere)
# ---------------------------------------------------------------------------

def fit_ar2(series: list[float]) -> dict | None:
    """
    Fit AR(2) to a pre-demeaned series using OLS.
    Returns phi1, phi2, eigenvalue modulus, stability, R², Fibonacci proximity.
    """
    n = len(series)
    if n < 6:
        return None
    mean = sum(series) / n
    s    = [x - mean for x in series]

    Y  = s[2:]
    Y1 = s[1:n - 1]
    Y2 = s[0:n - 2]
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

    disc = phi1 ** 2 + 4.0 * phi2
    if disc >= 0.0:
        r1 = (phi1 + math.sqrt(disc)) / 2.0
        r2 = (phi1 - math.sqrt(disc)) / 2.0
        modulus = max(abs(r1), abs(r2))
    else:
        real   = phi1 / 2.0
        imag   = math.sqrt(-disc) / 2.0
        modulus = math.sqrt(real ** 2 + imag ** 2)

    # stationarity triangle
    stable = (phi1 + phi2 < 1.0) and (phi2 - phi1 < 1.0) and (-1.0 < phi2 < 1.0)

    # R²
    pred   = [phi1 * Y1[i] + phi2 * Y2[i] for i in range(m)]
    meanY  = sum(Y) / m
    ss_tot = sum((y - meanY) ** 2 for y in Y)
    ss_res = sum((Y[i] - pred[i]) ** 2 for i in range(m))
    r2     = 1.0 - ss_res / ss_tot if ss_tot > 0 else 0.0

    # Fibonacci proximity (modulus-space approximation)
    inv_phi = 2.0 / (1.0 + math.sqrt(5.0))   # 1/φ ≈ 0.6180
    fp      = max(0.0, 100.0 * (1.0 - abs(modulus - inv_phi) / inv_phi))
    cls = ("Fibonacci-like" if fp >= 85.0 else
           "Near-Fibonacci"  if fp >= 50.0 else
           "Non-Fibonacci")

    return {
        "phi1":             round(phi1,    6),
        "phi2":             round(phi2,    6),
        "modulus":          round(modulus, 6),
        "stable":           stable,
        "r2":               round(r2,      4),
        "fibonacciProximity": round(fp,    2),
        "fibonacciClass":   cls,
    }


# ---------------------------------------------------------------------------
# Summary statistics
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
    r   = cov / (sx * sy)

    # two-tailed p via regularised incomplete beta
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
            m = m2; m2_ = 2 * m
            aa = m * (b - m) * x / ((qam + m2_) * (a + m2_))
            d = 1 + aa * d; d = max(abs(d), 1e-30); d = 1 / d
            c = 1 + aa / c; c = max(abs(c), 1e-30); h *= d * c
            aa = -(a + m) * (qab + m) * x / ((a + m2_) * (qap + m2_))
            d = 1 + aa * d; d = max(abs(d), 1e-30); d = 1 / d
            c = 1 + aa / c; c = max(abs(c), 1e-30)
            delta = d * c; h *= delta
            if abs(delta - 1) < 3e-7:
                break
        return front * h

    p = betainc((n - 2) / 2, 0.5, x)
    return r, p


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    if not CSV_PATH.exists():
        print(f"ERROR: CSV not found at {CSV_PATH}", file=sys.stderr)
        sys.exit(1)

    # Load Colas2019 rows
    colas_data: dict[str, list[float]] = {}
    with open(CSV_PATH, newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            if row["dataset"] == "Colas2019":
                vals = [float(row[f"H{h}"]) for h in range(24)]
                colas_data[row["subject"]] = vals

    print(f"Loaded {len(colas_data)} Colas2019 subjects from {CSV_PATH.name}")

    # Fit AR(2) for each subject
    results: list[dict] = []
    for subject, vals in sorted(colas_data.items()):
        mean = sum(vals) / len(vals)
        std  = math.sqrt(sum((x - mean) ** 2 for x in vals) / (len(vals) - 1))
        cv   = 100.0 * std / mean
        amplitude = max(vals) - min(vals)

        fit = fit_ar2(vals)
        if fit is None or not fit["stable"]:
            print(f"  SKIP {subject}: unstable or insufficient data")
            continue

        results.append({
            "subject":            subject,
            "meanGlucose":        round(mean,      3),
            "sdGlucose":          round(std,       3),
            "cvPercent":          round(cv,        3),
            "glucoseAmplitude":   round(amplitude, 3),
            "phi1":               fit["phi1"],
            "phi2":               fit["phi2"],
            "modulus":            fit["modulus"],
            "r2":                 fit["r2"],
            "fibonacciProximity": fit["fibonacciProximity"],
            "fibonacciClass":     fit["fibonacciClass"],
        })

    n = len(results)
    mods = [r["modulus"]    for r in results]
    cvs  = [r["cvPercent"]  for r in results]
    means= [r["meanGlucose"] for r in results]

    r_cv,   p_cv   = pearson(mods, cvs)
    r_mean, p_mean = pearson(mods, means)

    avg_mod = sum(mods) / n
    avg_cv  = sum(cvs)  / n

    # Print report
    print(f"\n{'─'*68}")
    print("COLAS 2019 — RESULTS BY EIGENVALUE (highest to lowest)")
    print(f"{'─'*68}")
    for r in sorted(results, key=lambda x: -x["modulus"]):
        bar = "█" * round(r["modulus"] * 20)
        print(f"  {r['subject']:12s}  mean={r['meanGlucose']:6.1f} mg/dL"
              f"  CV={r['cvPercent']:5.1f}%"
              f"  |λ|={r['modulus']:.4f} [{r['fibonacciClass'][:4]}]")

    print(f"\n{'─'*68}")
    print("SUMMARY")
    print(f"{'─'*68}")
    print(f"  n                         = {n}")
    print(f"  Mean |λ|                  = {avg_mod:.4f}")
    print(f"  Mean CV% (intra-day)      = {avg_cv:.1f}%")
    print(f"  r(|λ|, CV%)               = {r_cv:+.4f}  p = {p_cv:.4f}")
    print(f"  r(|λ|, mean glucose)      = {r_mean:+.4f}  p = {p_mean:.4f}")
    print()
    print("NOTE: CV% here is intra-day (from 24-hour hourly averages).")
    print("Multi-day clinical CV% from raw 5-minute CGM data would be")
    print("a stronger predictor of circadian-metabolic coupling status.")

    # Archive
    output = {
        "metadata": {
            "source": "Colas et al. (2019) CGM dataset — normoglycemic adults",
            "subjectCount": n,
            "method": "AR(2) eigenvalue modulus, mean-centred OLS (pure Python)",
            "input":  "24-hour hourly glucose means (datasets/cgm_circadian_combined.csv)",
            "note":   (
                "CV% is computed from 24-hour hourly means (intra-day circadian variability). "
                "This differs from clinical CGM CV% computed across all raw 5-minute readings "
                "over multiple days. The intra-day CV% reflects circadian glucose amplitude; "
                "multi-day CV% reflects overall glycaemic variability including meal and "
                "day-to-day effects."
            ),
        },
        "summary": {
            "avgModulus":             round(avg_mod, 6),
            "avgCV_intraday":         round(avg_cv,  4),
            "avgMeanGlucose":         round(sum(means) / n, 3),
            "r_modulus_cv_intraday":  round(r_cv,    6),
            "p_modulus_cv_intraday":  round(p_cv,    6),
            "r_modulus_meanGlucose":  round(r_mean,  6),
            "p_modulus_meanGlucose":  round(p_mean,  6),
        },
        "results": results,
    }
    with open(OUTPUT_PATH, "w") as f:
        json.dump(output, f, indent=2)
    print(f"\nResults archived to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
