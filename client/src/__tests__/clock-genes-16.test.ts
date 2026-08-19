/**
 * Guard the pre-registered Paper Q clock gene lists against silent substitution.
 *
 * The manuscript (Methods §Gene selection) states exactly 16 genes for mouse
 * (CLOCK_GENES_16) and the same 16 orthologues for baboon (CLOCK_GENES_BABOON_16).
 * Any swap, addition, or removal will cause live platform results to diverge
 * from the pre-registered set without warning.  These tests are the canary.
 *
 * If either test suite fails: update shared/clock-genes-16.ts AND the manuscript
 * in lockstep — never update one without the other.
 */

import { describe, it, expect } from "vitest";
import { CLOCK_GENES_16, CLOCK_GENES_BABOON_16 } from "@shared/clock-genes-16";

// ── Canonical set from manuscript Methods §Gene selection ─────────────────────
// "Arntl (Bmal1), Per1, Per2, Per3, Cry1, Cry2, Clock, Npas2,
//  Nr1d1 (Rev-erbα), Nr1d2 (Rev-erbβ), Dbp, Tef, Hlf, Rora, Rorb, Rorc"
const MANUSCRIPT_GENES_16 = new Set([
  "Arntl", "Per1",  "Per2",  "Per3",  "Cry1",  "Cry2",
  "Nr1d1", "Nr1d2", "Dbp",   "Tef",   "Hlf",   "Npas2",
  "Clock", "Rorc",  "Rora",  "Rorb",
]);

// ── Baboon orthologues: uppercase primate symbols as they appear in GSE98965 ──
// Manuscript §Baboon cross-species validation:
//   "AR(2) was applied to 16 clock gene orthologues across 60 baboon tissues"
// PER3 and NR1D2 are unstable (λ≥1) in the Lung tissue only; both remain in the
// pre-registered 16-gene set.
const MANUSCRIPT_BABOON_GENES_16 = new Set([
  "ARNTL", "PER1",  "PER2",  "PER3",  "CRY1",  "CRY2",
  "NR1D1", "NR1D2", "DBP",   "TEF",   "HLF",   "NPAS2",
  "CLOCK", "RORC",  "RORA",  "RORB",
]);

describe("CLOCK_GENES_16 — pre-registration guard (Paper Q)", () => {
  it("contains exactly 16 genes", () => {
    expect(CLOCK_GENES_16.length).toBe(16);
  });

  it("contains no duplicates", () => {
    const unique = new Set(CLOCK_GENES_16);
    expect(unique.size).toBe(CLOCK_GENES_16.length);
  });

  it("matches the manuscript gene set exactly (no additions)", () => {
    for (const gene of CLOCK_GENES_16) {
      expect(
        MANUSCRIPT_GENES_16.has(gene),
        `Gene "${gene}" is in CLOCK_GENES_16 but NOT in manuscript Methods §Gene selection`,
      ).toBe(true);
    }
  });

  it("matches the manuscript gene set exactly (no omissions)", () => {
    for (const gene of MANUSCRIPT_GENES_16) {
      expect(
        (CLOCK_GENES_16 as readonly string[]).includes(gene),
        `Manuscript gene "${gene}" is missing from CLOCK_GENES_16`,
      ).toBe(true);
    }
  });

  it("includes Rorb (the correct 16th gene, not Nfil3)", () => {
    expect((CLOCK_GENES_16 as readonly string[]).includes("Rorb")).toBe(true);
    expect((CLOCK_GENES_16 as readonly string[]).includes("Nfil3")).toBe(false);
  });
});

describe("CLOCK_GENES_BABOON_16 — pre-registration guard (Paper Q cross-species)", () => {
  it("contains exactly 16 baboon orthologue symbols", () => {
    expect(CLOCK_GENES_BABOON_16.length).toBe(16);
  });

  it("contains no duplicates", () => {
    const unique = new Set(CLOCK_GENES_BABOON_16);
    expect(unique.size).toBe(CLOCK_GENES_BABOON_16.length);
  });

  it("matches the manuscript baboon orthologue set exactly (no additions)", () => {
    for (const gene of CLOCK_GENES_BABOON_16) {
      expect(
        MANUSCRIPT_BABOON_GENES_16.has(gene),
        `Gene "${gene}" is in CLOCK_GENES_BABOON_16 but NOT in the manuscript-stated baboon orthologue set`,
      ).toBe(true);
    }
  });

  it("matches the manuscript baboon orthologue set exactly (no omissions)", () => {
    for (const gene of MANUSCRIPT_BABOON_GENES_16) {
      expect(
        (CLOCK_GENES_BABOON_16 as readonly string[]).includes(gene),
        `Manuscript baboon orthologue "${gene}" is missing from CLOCK_GENES_BABOON_16`,
      ).toBe(true);
    }
  });

  it("uses uppercase symbols (GSE98965 primate convention, not mouse title-case)", () => {
    for (const gene of CLOCK_GENES_BABOON_16) {
      expect(
        gene,
        `Gene "${gene}" must be fully uppercase to match GSE98965 FPKM column headers`,
      ).toBe(gene.toUpperCase());
    }
  });

  it("includes RORB (not NFIL3) as the correct 16th baboon orthologue", () => {
    expect((CLOCK_GENES_BABOON_16 as readonly string[]).includes("RORB")).toBe(true);
    expect((CLOCK_GENES_BABOON_16 as readonly string[]).includes("NFIL3")).toBe(false);
  });

  it("has same count as the mouse CLOCK_GENES_16 (strict 1:1 orthologue correspondence)", () => {
    expect(CLOCK_GENES_BABOON_16.length).toBe(CLOCK_GENES_16.length);
  });

  it("baboon symbols are the uppercase equivalents of the mouse symbols", () => {
    // Every mouse gene name uppercased should appear in the baboon set, and vice versa.
    // This guards against one list gaining a gene the other doesn't have.
    const mouseUpper = new Set(CLOCK_GENES_16.map(g => g.toUpperCase()));
    const baboonUpper = new Set(CLOCK_GENES_BABOON_16.map(g => g.toUpperCase()));
    for (const g of mouseUpper) {
      expect(
        baboonUpper.has(g),
        `Mouse gene "${g}" (uppercased) has no matching baboon orthologue in CLOCK_GENES_BABOON_16`,
      ).toBe(true);
    }
    for (const g of baboonUpper) {
      expect(
        mouseUpper.has(g),
        `Baboon gene "${g}" has no matching mouse orthologue in CLOCK_GENES_16`,
      ).toBe(true);
    }
  });
});
