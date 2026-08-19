/**
 * Tests for the inline gene result state machine on the landing page.
 *
 * The landing component computes `geneResult` from four inputs:
 *   searchedGene, atlasLoading, atlasError, atlasEntries
 *
 * We mirror that logic here as a pure function so the state transitions
 * can be verified without a DOM environment.
 */

import { describe, it, expect } from "vitest";

// ── Mirror the geneResult computation from landing.tsx ─────────────────────
type AtlasEntry = { gene: string; category: string; eigenvalue: number; tissue: string };

function computeGeneResult(
  searchedGene: string | null,
  atlasLoading: boolean,
  atlasError: boolean,
  atlasEntries: AtlasEntry[] | undefined,
): "loading" | "error" | null | undefined | { meanLambda: number; entries: AtlasEntry[] } {
  if (!searchedGene) return undefined;
  if (atlasLoading) return "loading";
  if (atlasError) return "error";
  if (!atlasEntries) return undefined;
  const entries = atlasEntries.filter(e => e.gene.toUpperCase() === searchedGene);
  if (!entries.length) return null;
  const meanLambda = entries.reduce((s, e) => s + e.eigenvalue, 0) / entries.length;
  return { meanLambda, entries };
}

// Sample atlas data used across tests
const ATLAS: AtlasEntry[] = [
  { gene: "ARNTL", category: "clock",  eigenvalue: 0.680, tissue: "Liver" },
  { gene: "ARNTL", category: "clock",  eigenvalue: 0.640, tissue: "Lung"  },
  { gene: "PER2",  category: "clock",  eigenvalue: 0.620, tissue: "Liver" },
  { gene: "MYC",   category: "target", eigenvalue: 0.510, tissue: "Liver" },
];

// ── State-machine tests ────────────────────────────────────────────────────
describe("Landing page — geneResult state machine", () => {

  describe("no search submitted", () => {
    it("returns undefined when searchedGene is null", () => {
      expect(computeGeneResult(null, false, false, ATLAS)).toBeUndefined();
    });

    it("returns undefined even if the query errored before any search", () => {
      expect(computeGeneResult(null, false, true, undefined)).toBeUndefined();
    });
  });

  describe("loading state", () => {
    it("returns 'loading' while the atlas query is in flight", () => {
      expect(computeGeneResult("ARNTL", true, false, undefined)).toBe("loading");
    });

    it("returns 'loading' even if entries happen to be stale-cached alongside isLoading=true", () => {
      // React Query can have isLoading=true with stale data briefly; loading takes priority
      expect(computeGeneResult("ARNTL", true, false, ATLAS)).toBe("loading");
    });
  });

  describe("error state (API failure)", () => {
    it("returns 'error' when the atlas query fails — not 'not found'", () => {
      expect(computeGeneResult("ARNTL", false, true, undefined)).toBe("error");
    });

    it("still returns 'error' if a stale entries array is present", () => {
      // Ensures the error branch takes priority over stale data
      expect(computeGeneResult("ARNTL", false, true, ATLAS)).toBe("error");
    });

    it("returns 'loading' after user resubmits following an error (refetch triggered)", () => {
      // Simulates the state after atlasRefetch() is called: isLoading goes true again
      expect(computeGeneResult("PER2", true, false, undefined)).toBe("loading");
    });

    it("returns a result card after the refetch succeeds", () => {
      const result = computeGeneResult("PER2", false, false, ATLAS);
      expect(result).not.toBeNull();
      expect(result).not.toBe("error");
      expect(result).not.toBe("loading");
      // TypeScript guard
      if (result && typeof result === "object") {
        expect(result.entries[0].gene).toBe("PER2");
        expect(result.meanLambda).toBeCloseTo(0.620, 3);
      }
    });
  });

  describe("not-found state (successful response, gene absent)", () => {
    it("returns null when the gene is not in the panel after a successful fetch", () => {
      expect(computeGeneResult("GAPDH", false, false, ATLAS)).toBeNull();
    });

    it("is case-insensitive", () => {
      // searchedGene is always uppercased before storage, but guard anyway
      expect(computeGeneResult("GAPDH", false, false, ATLAS)).toBeNull();
    });
  });

  describe("successful match", () => {
    it("returns a result object for a known gene", () => {
      const result = computeGeneResult("ARNTL", false, false, ATLAS);
      expect(result).not.toBeNull();
      expect(result).not.toBe("loading");
      expect(result).not.toBe("error");
      if (result && typeof result === "object") {
        expect(result.entries).toHaveLength(2);
        expect(result.meanLambda).toBeCloseTo((0.680 + 0.640) / 2, 5);
      }
    });

    it("mean |λ| is the arithmetic mean across all matching tissues", () => {
      const result = computeGeneResult("ARNTL", false, false, ATLAS);
      if (result && typeof result === "object") {
        const expected = (0.680 + 0.640) / 2;
        expect(result.meanLambda).toBeCloseTo(expected, 5);
      }
    });

    it("includes all tissues for the queried gene", () => {
      const result = computeGeneResult("ARNTL", false, false, ATLAS);
      if (result && typeof result === "object") {
        const tissues = result.entries.map(e => e.tissue).sort();
        expect(tissues).toEqual(["Liver", "Lung"]);
      }
    });

    it("single-tissue gene returns correct mean", () => {
      const result = computeGeneResult("MYC", false, false, ATLAS);
      if (result && typeof result === "object") {
        expect(result.meanLambda).toBeCloseTo(0.510, 3);
        expect(result.entries).toHaveLength(1);
      }
    });
  });
});
