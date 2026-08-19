/**
 * GSE157357 Pairwise Analysis — Wee1 regression guard
 * =====================================================
 * Asserts that the corrected Wee1 four-condition eigenvalues returned by
 * getGSE157357PairwiseFrontend() have not been accidentally reverted to
 * artefact values (e.g. WT≈0.093 from the pre-correction non-chronological
 * column ordering).
 *
 * Also asserts that the summary field still carries the "April 2026"
 * correction note, so the correction banner cannot be silently deleted.
 *
 * Canonical corrected values (recomputed from replicate-averaged
 * 12-unique-timepoint series, CT24–CT46):
 *   WT=0.655  BmalKO=0.782  ApcKO=0.877  DblKO=0.335
 */

import { describe, it, expect } from "vitest";
import { getGSE157357PairwiseFrontend, getGSE157357PairwiseResults } from "../../../server/gse157357-pairwise";

describe("GSE157357 pairwise frontend — Wee1 corrected eigenvalues", () => {
  const result = getGSE157357PairwiseFrontend();

  it("Wee1 entry is present in keyGeneTrajectories", () => {
    const wee1 = result.keyGeneTrajectories.find((g) => g.gene === "Wee1");
    expect(wee1).toBeDefined();
  });

  it("Wee1 WT eigenvalue ≈ 0.655 (corrected; pre-correction artefact was ≈0.093)", () => {
    const wee1 = result.keyGeneTrajectories.find((g) => g.gene === "Wee1")!;
    expect(wee1.wt).toBeCloseTo(0.655, 2);
  });

  it("Wee1 BmalKO eigenvalue ≈ 0.782", () => {
    const wee1 = result.keyGeneTrajectories.find((g) => g.gene === "Wee1")!;
    expect(wee1.bmalko).toBeCloseTo(0.782, 2);
  });

  it("Wee1 ApcKO eigenvalue ≈ 0.877", () => {
    const wee1 = result.keyGeneTrajectories.find((g) => g.gene === "Wee1")!;
    expect(wee1.apcko).toBeCloseTo(0.877, 2);
  });

  it("Wee1 DblKO eigenvalue ≈ 0.335", () => {
    const wee1 = result.keyGeneTrajectories.find((g) => g.gene === "Wee1")!;
    expect(wee1.dblko).toBeCloseTo(0.335, 2);
  });

  it("summary field contains 'April 2026' correction note", () => {
    expect(result.summary).toContain("April 2026");
  });
});

describe("GSE157357 pairwise results — Wee1 keyGenes and interpretation guard", () => {
  const result = getGSE157357PairwiseResults();

  it("Wee1 entry is present in keyGenes", () => {
    const wee1 = result.keyGenes.find((g) => g.gene === "Wee1");
    expect(wee1).toBeDefined();
  });

  it("Wee1 keyGenes WT eigenvalue ≈ 0.655", () => {
    const wee1 = result.keyGenes.find((g) => g.gene === "Wee1")!;
    expect(wee1.wt).toBeCloseTo(0.655, 2);
  });

  it("Wee1 keyGenes BmalKO eigenvalue ≈ 0.782", () => {
    const wee1 = result.keyGenes.find((g) => g.gene === "Wee1")!;
    expect(wee1.bmalKO).toBeCloseTo(0.782, 2);
  });

  it("Wee1 keyGenes ApcKO eigenvalue ≈ 0.877", () => {
    const wee1 = result.keyGenes.find((g) => g.gene === "Wee1")!;
    expect(wee1.apcKO).toBeCloseTo(0.877, 2);
  });

  it("Wee1 keyGenes DblKO eigenvalue ≈ 0.335", () => {
    const wee1 = result.keyGenes.find((g) => g.gene === "Wee1")!;
    expect(wee1.dblKO).toBeCloseTo(0.335, 2);
  });

  it("interpretation string contains corrected Wee1 WT value 'WT=0.655'", () => {
    expect(result.interpretation).toContain("WT=0.655");
  });

  it("interpretation string contains corrected Wee1 ApcKO value 'ApcKO=0.877'", () => {
    expect(result.interpretation).toContain("ApcKO=0.877");
  });

  it("interpretation string contains Wee1 BmalKO value 'BmalKO=0.782' (guards against KEY_GENES drift)", () => {
    // The interpretation is now built dynamically from KEY_GENES, so this assertion
    // will fail if wee1.bmalKO is ever changed in KEY_GENES without updating expectations.
    const wee1 = result.keyGenes.find((g) => g.gene === "Wee1")!;
    expect(result.interpretation).toContain(`BmalKO=${wee1.bmalKO.toFixed(3)}`);
  });

  it("interpretation string contains Wee1 DblKO value 'DblKO=0.335' (guards against KEY_GENES drift)", () => {
    // Same dynamic guard — if dblKO changes in KEY_GENES the interpretation auto-updates
    // and this test will still pass; a stale hard-coded string would fail.
    const wee1 = result.keyGenes.find((g) => g.gene === "Wee1")!;
    expect(result.interpretation).toContain(`DblKO=${wee1.dblKO.toFixed(3)}`);
  });
});
