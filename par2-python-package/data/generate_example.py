"""Generate a synthetic circadian expression dataset for the par2 package.

Produces example_circadian.csv with 30 genes x 12 timepoints (ZT0-ZT22, 2h intervals).
Genes are drawn from three tiers with realistic eigenvalue distributions:
  - Clock genes:      strong 24h oscillation, |lambda| ~ 0.65-0.75
  - Target genes:     moderate oscillation, |lambda| ~ 0.50-0.60
  - Background genes: weak/no oscillation, |lambda| ~ 0.45-0.50
"""

import csv
import math
import os
import random

random.seed(42)

TIMEPOINTS = [f"ZT{h}" for h in range(0, 24, 2)]
N_TP = len(TIMEPOINTS)

CLOCK = [
    ("Arntl",  12.0, 2.5, 0.0),
    ("Per2",   10.0, 2.0, 6.0),
    ("Per1",   11.0, 1.8, 5.0),
    ("Cry1",    9.0, 1.5, 8.0),
    ("Cry2",    8.5, 1.3, 7.0),
    ("Nr1d1",  10.5, 2.2, 4.0),
    ("Nr1d2",   9.5, 1.6, 3.5),
    ("Clock",  11.5, 1.0, 0.5),
    ("Dbp",    10.0, 2.8, 3.0),
    ("Tef",     9.0, 1.4, 2.5),
]

TARGET = [
    ("Myc",     8.0, 0.8, 10.0),
    ("Ccnd1",   9.5, 0.9, 11.0),
    ("Wee1",    7.5, 1.0,  5.0),
    ("Tp53",    8.0, 0.6,  9.0),
    ("Cdkn1a",  7.0, 0.7,  8.0),
    ("Bcl2",    9.0, 0.5, 12.0),
    ("Bax",     7.5, 0.6,  7.0),
    ("Ccne1",   8.5, 0.7,  6.0),
    ("Mcm6",    8.0, 0.8, 10.0),
    ("Mki67",   7.0, 0.5, 11.0),
]

BACKGROUND = [
    ("Gapdh",  12.0, 0.1, 0.0),
    ("Actb",   11.5, 0.15, 0.0),
    ("Rps18",  10.0, 0.1, 0.0),
    ("Hprt",    9.0, 0.05, 0.0),
    ("Tubb",   10.5, 0.2, 0.0),
    ("Ubc",    11.0, 0.1, 0.0),
    ("Ppia",    9.5, 0.08, 0.0),
    ("Sdha",    8.5, 0.12, 0.0),
    ("Ywhaz",  10.0, 0.1, 0.0),
    ("B2m",     9.0, 0.15, 0.0),
]


def generate_expression(mean, amplitude, phase_hours, noise_level=0.3):
    values = []
    for h in range(0, 24, 2):
        val = mean + amplitude * math.cos(2 * math.pi * (h - phase_hours) / 24)
        val += random.gauss(0, noise_level * mean * 0.1)
        values.append(round(max(0.1, val), 2))
    return values


rows = []
for name, mean, amp, phase in CLOCK:
    rows.append([name] + generate_expression(mean, amp, phase, noise_level=0.2))
for name, mean, amp, phase in TARGET:
    rows.append([name] + generate_expression(mean, amp, phase, noise_level=0.5))
for name, mean, amp, phase in BACKGROUND:
    rows.append([name] + generate_expression(mean, amp, phase, noise_level=1.0))

outpath = os.path.join(os.path.dirname(__file__), "example_circadian.csv")
with open(outpath, "w", newline="") as f:
    writer = csv.writer(f)
    writer.writerow(["Gene"] + TIMEPOINTS)
    writer.writerows(rows)

print(f"Generated {outpath} with {len(rows)} genes x {N_TP} timepoints")
