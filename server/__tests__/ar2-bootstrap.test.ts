import { describe, it, expect } from 'vitest';
import { bootstrapAR2, fitAR2 } from '../ar2-shared';

/** Damped 24 h oscillation sampled every 2 h, |λ| ≈ target. */
function dampedSeries(lambda: number, n: number, noise = 0.05): number[] {
  const omega = (2 * Math.PI) / 12;
  const phi1 = 2 * lambda * Math.cos(omega);
  const phi2 = -(lambda * lambda);
  const x = [1, 0.9];
  let seed = 7;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648 - 0.5;
  };
  for (let t = 2; t < n; t++) {
    x.push(phi1 * x[t - 1] + phi2 * x[t - 2] + noise * rand());
  }
  return x;
}

describe('bootstrapAR2', () => {
  it('reports an ordered interval around the same fit as fitAR2', () => {
    const series = dampedSeries(0.7, 24, 0.3);
    const result = bootstrapAR2(series, { draws: 400, seed: 1 })!;
    expect(result).not.toBeNull();
    expect(result.eigenvalue).toBeCloseTo(fitAR2(series)!.eigenvalue, 10);
    expect(result.eigenvalueCI[0]).toBeLessThan(result.eigenvalueCI[1]);
    expect(result.eigenvalueCI[0]).toBeLessThanOrEqual(result.eigenvalue);
    expect(result.eigenvalueCI[1]).toBeGreaterThanOrEqual(result.eigenvalue);
    expect(result.phi1CI[0]).toBeLessThan(result.phi1CI[1]);
    expect(result.phi2CI[0]).toBeLessThan(result.phi2CI[1]);
    expect(result.n).toBe(24);
  });

  it('is deterministic for a given seed and varies with the seed', () => {
    const series = dampedSeries(0.7, 24);
    const a = bootstrapAR2(series, { draws: 300, seed: 11 })!;
    // same seed -> identical interval; different seed -> different resamples
    const b = bootstrapAR2(series, { draws: 300, seed: 11 })!;
    const c = bootstrapAR2(series, { draws: 300, seed: 12 })!;
    expect(a.eigenvalueCI).toEqual(b.eigenvalueCI);
    expect(c.eigenvalueCI).not.toEqual(a.eigenvalueCI);
  });

  it('narrows as the series lengthens', () => {
    const short = bootstrapAR2(dampedSeries(0.7, 24, 0.3), { draws: 500, seed: 3 })!;
    const long = bootstrapAR2(dampedSeries(0.7, 96, 0.3), { draws: 500, seed: 3 })!;
    const width = (r: typeof short) => r.eigenvalueCI[1] - r.eigenvalueCI[0];
    expect(width(long)).toBeLessThan(width(short));
  });

  it('is far too wide to resolve a 0.03-wide band at realistic noise and 24 timepoints', () => {
    const result = bootstrapAR2(dampedSeries(0.618, 24, 0.3), { draws: 500, seed: 5 })!;
    expect(result.eigenvalueCI[1] - result.eigenvalueCI[0]).toBeGreaterThan(0.1);
  });

  it('returns null for a series shorter than the fit minimum', () => {
    expect(bootstrapAR2([1, 2, 3])).toBeNull();
  });
});
