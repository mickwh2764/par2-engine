"""Derived metrics from AR(2) eigenvalues."""

import math


def half_life(eigenvalue: float, sampling_interval: float = 2.0) -> float:
    """Compute the half-life in the same units as the sampling interval.

    Parameters
    ----------
    eigenvalue : float
        |lambda| from AR(2) fit (must be 0 < |lambda| < 1).
    sampling_interval : float
        Time between consecutive samples (default 2 hours).

    Returns
    -------
    float : half-life in time units, or float('inf') if |lambda| >= 1.
    """
    if eigenvalue <= 0:
        return 0.0
    if eigenvalue >= 1.0:
        return float("inf")
    return sampling_interval * math.log(2) / (-math.log(eigenvalue))


def eigenperiod(phi1: float, phi2: float, sampling_interval: float = 2.0) -> float:
    """Compute the intrinsic oscillation period from AR(2) coefficients.

    Only meaningful for complex roots (disc < 0). Returns NaN for real roots.

    Parameters
    ----------
    phi1 : float
        AR(2) coefficient 1.
    phi2 : float
        AR(2) coefficient 2.
    sampling_interval : float
        Time between consecutive samples (default 2 hours).

    Returns
    -------
    float : oscillation period in time units, or NaN if roots are real.
    """
    disc = phi1 ** 2 + 4 * phi2
    if disc >= 0:
        return float("nan")
    omega = math.atan2(math.sqrt(-disc), phi1)
    if omega <= 0:
        return float("nan")
    return sampling_interval * 2 * math.pi / omega
