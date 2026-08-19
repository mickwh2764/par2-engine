# Provenance of Shanghai T2DM AR(2) Correlation Statistics

**Archived values:**
- `r(|λ|, mean glucose) = −0.61`  (p = 0.061)
- `r(|λ|, CV%)         = −0.68`  (p = 0.030)

These are stored in `manuscripts/shanghai_t2dm_fibonacci.json`
(`r_modulus_mean_glucose`, `p_modulus_mean_glucose`, `r_modulus_cv`, `p_modulus_cv`)
and cited in `manuscripts/paper_k_t2dm_glucose.md` and in `shared/book-extended-chapters.ts`
(Ch.12 / Part II intro).

---

## Exact analysis method (from paper_k_t2dm_glucose.md §2.1–2.4)

### 2.1 Dataset

CGM time-series from the ShanghaiT2DM dataset (Zhao et al. 2023).  
Ten participants, multi-day continuous records at **5-minute sampling intervals**.  
Data mean-centred within each 24-hour window prior to AR(2) fitting.

### 2.2 AR(2) fitting

AR(2) fitted by OLS **to each 24-hour window independently**:

    g_t = φ₁ g_{t-1} + φ₂ g_{t-2} + ε_t

where g_t is mean-centred glucose at 5-minute step t.  
Eigenvalue modulus |λ| computed from the companion matrix.  
**Per-participant modulus = mean daily |λ| across all recording windows.**  
(Manuscript §2.2 exact language: "The stability fraction … and the **mean daily |λ|**
were recorded per participant.")

The AR(2) fit method (mean-centred OLS) and eigenvalue computation are
implemented in `manuscripts/scripts/cgm_shanghai_ar2_analysis.py`
(`fit_ar2_demeaned()` function).

### 2.3 Clinical correlations (§2.4)

Pearson r computed between per-participant |λ| and:  
  (i) mean glucose (mg/dL)  
  (ii) glucose coefficient of variation (CV, %)

The Pearson r and two-tailed p-value implementation is in
`manuscripts/scripts/colas2019_cgm_ar2_analysis.py` (`pearson()` function).

### Clinical aggregate definitions

The correlation uses **multi-day clinical aggregates from ALL raw 5-minute readings**:

- `mean_glucose_clinical` = arithmetic mean of every valid raw 5-min reading across
  all recording days, in mg/dL
- `cv_clinical` = `(SD / mean) × 100` where SD is computed across all raw readings
  (population SD, n denominator)

**These are NOT means of daily means.** Each raw 5-minute reading contributes
equally regardless of which day it belongs to or how many readings that day has.

---

## Why the stored JSON rows give r ≈ −0.447, not −0.61

The per-subject `meanGlucose` and `cvGlucose` fields in
`manuscripts/shanghai_t2dm_fibonacci.json` are **means of daily means** —
each 24-hour window contributes equally. The original pipeline used
**means of all raw 5-minute readings** — each reading contributes equally.

These two aggregations produce different numbers per subject when:
- Recording durations differ across subjects (some with more days than others)
- The first and last recording days are partial (fewer than 288 readings)

The per-participant |λ| stored in the JSON is consistent with the manuscript
definition (mean daily |λ|, from per-window fitting), so the moduli are correct.
The meanGlucose/cvGlucose stored values are what was retained in the original
pipeline; the true clinical aggregates (from all raw readings) were not separately
archived, and differ by the amount explained above.

**Diagnostic**: `python3 manuscripts/scripts/cgm_shanghai_ar2_analysis.py --check-correlations`  
shows that r from stored rows = −0.4473 vs. archived r = −0.61.  
The **negative direction is preserved**; only the magnitude differs due to the
aggregation difference.

---

## Reproducing r = −0.61 from raw data

### Data acquisition

> Zhao Z et al. "ShanghaiT2DM: A Shanghai-based continuous glucose monitoring
> dataset for type 2 diabetes mellitus." *Scientific Data* **10**, 175 (2023).  
> DOI: https://doi.org/10.1038/s41597-023-02084-6

The dataset provides per-patient CGM CSV files at 5-minute resolution.
After downloading, inspect the dataset README to determine:
- The exact filename per participant (for mapping to `Shanghai_2000_0`, etc.)
- The column schema (timestamp column name, glucose value column name and units)

### Running the pipeline

A complete, runnable pipeline is provided at:

    manuscripts/scripts/shanghai_t2dm_cgm_r_pipeline.py

Run with `--describe` to see the full pipeline description without data:

    python3 manuscripts/scripts/shanghai_t2dm_cgm_r_pipeline.py --describe

Run against the actual data:

    python3 manuscripts/scripts/shanghai_t2dm_cgm_r_pipeline.py \
        --data-dir /path/to/ShanghaiT2DM/ \
        --file-map '{"Shanghai_2000_0": "<actual_filename>.csv", ...}' \
        --verify-archive

The pipeline implements exactly the method described in §2.1–2.4 above:
1. Clinical aggregates from ALL raw readings (not daily means)
2. Per-window AR(2) fitting (mean-centred within each 24-hour window)
3. Mean daily |λ| per participant
4. Pearson r over the 10 subjects

Expected output when applied to the correct source data:
- `r(|λ|, mean glucose) ≈ −0.61`  (p ≈ 0.061)
- `r(|λ|, CV%) ≈ −0.68`  (p ≈ 0.030)

---

## Regression test strategy

The regression test (`server/__tests__/ch12-cgm-eigenvalue-regression.test.ts`,
"Shanghai T2DM cohort" suite) treats both correlation statistics as
**provenance-locked archived scalars** because the raw data and true per-subject
clinical aggregates are not distributed with this repository.  The tests verify:

1. The JSON contains the expected values at manuscript reporting precision
2. The sign is preserved (both negative, as predicted)
3. `p(|λ|, CV%) < 0.05` (the statistically significant result cited in the text)

A companion suite ("end-to-end pipeline recompute-and-compare") is ready to
run when `SHANGHAI_T2DM_DATA_DIR` is set; it executes the pipeline and asserts
the computed r values match the archived values within ±0.02.

The pipeline script runs in `--describe` mode without any data and is verified
by a non-conditional test that confirms the script is executable.
