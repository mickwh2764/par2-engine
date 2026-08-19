"""Core AR(2) fitting and eigenvalue computation."""

import numpy as np
from typing import Dict, List, Optional, Tuple, Union


def fit_ar2(
    expression: Union[List[float], np.ndarray],
    n_bootstrap: int = 0,
    seed: Optional[int] = None,
) -> Dict:
    """Fit an AR(2) model to a single gene expression time series.

    The expression values are mean-centred before fitting. The model is:
        x(t) = phi1 * x(t-1) + phi2 * x(t-2) + epsilon

    The eigenvalue modulus |lambda| is computed from the characteristic
    equation r^2 - phi1*r - phi2 = 0:
      - Complex roots: |lambda| = sqrt(-phi2)
      - Real roots: |lambda| = max(|r1|, |r2|)

    Parameters
    ----------
    expression : array-like
        Gene expression values (minimum 6 timepoints).
    n_bootstrap : int, default 0
        When > 0, also return a residual-bootstrap 95% confidence interval for
        |lambda|, phi1 and phi2 (see `bootstrap_ar2`). 2000 draws is ample.
    seed : int, optional
        Seed for the bootstrap resampling, for reproducible intervals.

    Returns
    -------
    dict with keys:
        eigenvalue : float  -- |lambda|, the eigenvalue modulus
        phi1 : float        -- AR(2) coefficient 1
        phi2 : float        -- AR(2) coefficient 2
        r2 : float          -- goodness of fit (R-squared)
        root_type : str     -- 'Complex' or 'Real'
        half_life : float   -- ln(2) / ln(|lambda|) if |lambda| > 0 and < 1
        eigenperiod : float -- period from complex roots (NaN for real roots)

    With n_bootstrap > 0, additionally:
        eigenvalue_ci : [low, high] -- 95% percentile interval for |lambda|
        phi1_ci, phi2_ci : [low, high]
        n_timepoints : int

    Notes
    -----
    A point estimate of |lambda| from a short series is imprecise: at 24 evenly
    sampled timepoints the 95% interval is typically ~0.4 wide, and the
    estimator is biased upward below ~24 points. Report the interval alongside
    any per-gene value, and do not interpret differences smaller than it.
    """
    x = np.asarray(expression, dtype=np.float64)
    if len(x) < 6:
        raise ValueError(f"Need >= 6 timepoints, got {len(x)}")

    x = x - np.mean(x)

    y = x[2:]
    X = np.column_stack([x[1:-1], x[:-2]])

    XtX = X.T @ X
    Xty = X.T @ y
    try:
        phi = np.linalg.solve(XtX, Xty)
    except np.linalg.LinAlgError:
        phi = np.linalg.lstsq(X, y, rcond=None)[0]

    phi1, phi2 = float(phi[0]), float(phi[1])

    y_pred = X @ phi
    ss_res = float(np.sum((y - y_pred) ** 2))
    ss_tot = float(np.sum((y - np.mean(y)) ** 2))
    r2 = 1.0 - ss_res / ss_tot if ss_tot > 0 else 0.0

    disc = phi1 ** 2 + 4 * phi2
    if disc < 0:
        root_type = "Complex"
        eigenvalue = np.sqrt(-phi2)
        omega = np.arctan2(np.sqrt(-disc), phi1)
        eigenperiod = 2 * np.pi / omega if omega > 0 else float("nan")
    else:
        root_type = "Real"
        sqrt_disc = np.sqrt(disc)
        r1 = (phi1 + sqrt_disc) / 2
        r2_root = (phi1 - sqrt_disc) / 2
        eigenvalue = max(abs(r1), abs(r2_root))
        eigenperiod = float("nan")

    eigenvalue = float(min(eigenvalue, 2.0))

    if 0 < eigenvalue < 1:
        hl = np.log(2) / (-np.log(eigenvalue))
    else:
        hl = float("nan")

    result = {
        "eigenvalue": round(eigenvalue, 6),
        "phi1": round(phi1, 6),
        "phi2": round(phi2, 6),
        "r2": round(r2, 6),
        "root_type": root_type,
        "half_life": round(hl, 4) if not np.isnan(hl) else None,
        "eigenperiod": round(eigenperiod, 4) if not np.isnan(eigenperiod) else None,
    }

    if n_bootstrap > 0:
        result.update(bootstrap_ar2(x, phi1, phi2, n_bootstrap=n_bootstrap, seed=seed))

    return result


def bootstrap_ar2(
    centred: np.ndarray,
    phi1: float,
    phi2: float,
    n_bootstrap: int = 2000,
    seed: Optional[int] = None,
    ci: float = 95.0,
) -> Dict:
    """Residual-bootstrap confidence intervals for an AR(2) fit.

    The fitted residuals are resampled with replacement, the series is
    regenerated from the fitted recursion, and the model is refitted; the
    percentile interval over the refits is returned. This is the standard
    interval for autoregressive coefficients and requires only the single
    fitted series -- no biological replicates, which most circadian designs
    (one animal pool per timepoint) do not provide.

    Parameters
    ----------
    centred : ndarray
        The mean-centred series the coefficients were fitted to.
    phi1, phi2 : float
        Fitted AR(2) coefficients.

    Returns
    -------
    dict with 'eigenvalue_ci', 'phi1_ci', 'phi2_ci' (each [low, high]) and
    'n_timepoints'.
    """
    x = np.asarray(centred, dtype=np.float64)
    n = len(x)
    resid = x[2:] - (phi1 * x[1:-1] + phi2 * x[:-2])
    resid = resid - resid.mean()

    rng = np.random.default_rng(seed)
    lambdas: List[float] = []
    phi1s: List[float] = []
    phi2s: List[float] = []
    for _ in range(n_bootstrap):
        eps = rng.choice(resid, n - 2, replace=True)
        xb = np.empty(n)
        xb[:2] = x[:2]
        for t in range(2, n):
            xb[t] = phi1 * xb[t - 1] + phi2 * xb[t - 2] + eps[t - 2]
        try:
            refit = fit_ar2(xb)
        except (ValueError, np.linalg.LinAlgError):
            continue
        lambdas.append(refit["eigenvalue"])
        phi1s.append(refit["phi1"])
        phi2s.append(refit["phi2"])

    lo, hi = (100 - ci) / 2, 100 - (100 - ci) / 2

    def interval(draws: List[float]) -> Optional[List[float]]:
        if not draws:
            return None
        return [round(float(v), 6) for v in np.percentile(draws, [lo, hi])]

    return {
        "eigenvalue_ci": interval(lambdas),
        "phi1_ci": interval(phi1s),
        "phi2_ci": interval(phi2s),
        "n_timepoints": n,
    }


def fit_ar2_batch(
    expression_matrix: np.ndarray,
    gene_names: Optional[List[str]] = None,
) -> List[Dict]:
    """Fit AR(2) to every row of an expression matrix.

    Parameters
    ----------
    expression_matrix : ndarray of shape (n_genes, n_timepoints)
    gene_names : optional list of gene name strings

    Returns
    -------
    List of result dicts (same format as fit_ar2), each with an added
    'gene' key.
    """
    n_genes = expression_matrix.shape[0]
    if gene_names is None:
        gene_names = [f"Gene_{i}" for i in range(n_genes)]

    results = []
    for i in range(n_genes):
        row = expression_matrix[i]
        valid = ~np.isnan(row)
        expr = row[valid]
        if len(expr) < 6:
            continue
        try:
            res = fit_ar2(expr)
            res["gene"] = gene_names[i]
            results.append(res)
        except Exception:
            continue

    results.sort(key=lambda r: r["eigenvalue"], reverse=True)
    return results


def classify_dynamics(eigenvalue: float, root_type: str) -> str:
    """Classify a gene's dynamics from its AR(2) result.

    Returns one of:
        'Sustained oscillator' -- |lambda| >= 0.8, complex roots
        'Damped oscillator'    -- 0.4 <= |lambda| < 0.8, complex roots
        'Overdamped decay'     -- real roots, |lambda| >= 0.4
        'Rapid decay'          -- |lambda| < 0.4
        'Unstable'             -- |lambda| >= 1.0
    """
    if eigenvalue >= 1.0:
        return "Unstable"
    if root_type == "Complex":
        if eigenvalue >= 0.8:
            return "Sustained oscillator"
        elif eigenvalue >= 0.4:
            return "Damped oscillator"
        else:
            return "Rapid decay"
    else:
        if eigenvalue >= 0.4:
            return "Overdamped decay"
        else:
            return "Rapid decay"
