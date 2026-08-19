import { describe, it, expect } from "vitest";
import {
  GSE11923,
  GSE54650_LIVER,
  CROSS_TISSUE_TAU,
  DISEASE_PHASE_STATES,
} from "@shared/canonical-values";

const tauC = (lambda: number) => -2 / Math.log(lambda);

describe("Canonical AR(2) values — internal consistency", () => {

  describe("GSE11923 Dbp — companion matrix math", () => {
    it("|λ|² = eigenvalueReal² + eigenvalueImag²", () => {
      const { eigenvalueReal, eigenvalueImag, lambda } = GSE11923.dbp;
      const mag = Math.sqrt(eigenvalueReal ** 2 + eigenvalueImag ** 2);
      expect(mag).toBeCloseTo(lambda, 2);
    });

    it("|λ| = sqrt(−phi2) for complex roots", () => {
      const { phi2, lambda } = GSE11923.dbp;
      expect(Math.sqrt(-phi2)).toBeCloseTo(lambda, 2);
    });
  });

  describe("GSE54650 Arntl — companion matrix math", () => {
    it("|λ|² = eigenvalueReal² + eigenvalueImag²", () => {
      const { eigenvalueReal, eigenvalueImag, lambda } = GSE54650_LIVER.arntl;
      const mag = Math.sqrt(eigenvalueReal ** 2 + eigenvalueImag ** 2);
      expect(mag).toBeCloseTo(lambda, 2);
    });

    it("|λ| = sqrt(−phi2) for complex roots", () => {
      const { phi2, lambda } = GSE54650_LIVER.arntl;
      expect(Math.sqrt(-phi2)).toBeCloseTo(lambda, 2);
    });
  });

  describe("GSE54650 Dbp — companion matrix math", () => {
    it("|λ| = sqrt(−phi2) for complex roots", () => {
      const { phi2, lambda } = GSE54650_LIVER.dbp;
      expect(Math.sqrt(-phi2)).toBeCloseTo(lambda, 2);
    });
  });

  describe("τ_c formula — single-gene GSE54650 liver", () => {
    it("Arntl τ_c ≈ documented clockTauH", () => {
      expect(tauC(GSE54650_LIVER.arntl.lambda)).toBeCloseTo(
        GSE54650_LIVER.healthyPhaseRatio.clockTauH,
        0,
      );
    });

    it("Dbp τ_c ≈ documented targetTauH", () => {
      expect(tauC(GSE54650_LIVER.dbp.lambda)).toBeCloseTo(
        GSE54650_LIVER.healthyPhaseRatio.targetTauH,
        0,
      );
    });

    it("clock τ_c / target τ_c ≈ documented healthyPhaseRatio", () => {
      const ratio =
        tauC(GSE54650_LIVER.arntl.lambda) / tauC(GSE54650_LIVER.dbp.lambda);
      expect(ratio).toBeCloseTo(GSE54650_LIVER.healthyPhaseRatio.ratio, 1);
    });
  });

  describe("Disease phase diagram — τ_c ratios from λ values", () => {
    it("healthy ratio ≈ 2.19× from stored lambdas", () => {
      const ratio =
        tauC(DISEASE_PHASE_STATES.healthy.clockLambda) /
        tauC(DISEASE_PHASE_STATES.healthy.targetLambda);
      expect(ratio).toBeCloseTo(DISEASE_PHASE_STATES.healthy.ratio, 1);
    });

    it("BmalKO ratio ≈ 0.99× (near parity)", () => {
      const ratio =
        tauC(DISEASE_PHASE_STATES.bmal1KO.clockLambda) /
        tauC(DISEASE_PHASE_STATES.bmal1KO.targetLambda);
      expect(ratio).toBeCloseTo(DISEASE_PHASE_STATES.bmal1KO.ratio, 1);
    });

    it("ApcKO stored lambdas show inverted hierarchy (targetLambda > clockLambda)", () => {
      expect(DISEASE_PHASE_STATES.apcKO.targetLambda).toBeGreaterThan(
        DISEASE_PHASE_STATES.apcKO.clockLambda,
      );
    });

    it("ApcKO stored ratio is < 1 (hierarchy inverted)", () => {
      expect(DISEASE_PHASE_STATES.apcKO.ratio).toBeLessThan(1);
    });

    it("GSE54650 single-gene ratio matches DISEASE_PHASE_STATES.healthy.ratio", () => {
      expect(GSE54650_LIVER.healthyPhaseRatio.ratio).toBeCloseTo(
        DISEASE_PHASE_STATES.healthy.ratio,
        2,
      );
    });
  });

  describe("Cross-tissue population statistics", () => {
    it("mean clock τ_c / mean target τ_c ≈ stated tauRatio (rounded values)", () => {
      const ratio =
        CROSS_TISSUE_TAU.meanClockTauH / CROSS_TISSUE_TAU.meanTargetTauH;
      expect(ratio).toBeCloseTo(CROSS_TISSUE_TAU.tauRatio, 0);
    });
  });

  describe("Literature concordance arithmetic", () => {
    it("aboveBackgroundMedianN / genesTestedN = percentRecovery / 100", () => {
      const { genesTestedN, aboveBackgroundMedianN, percentRecovery } =
        GSE11923.literatureConcordance;
      const computed = (aboveBackgroundMedianN / genesTestedN) * 100;
      expect(computed).toBeCloseTo(percentRecovery, 1);
    });
  });

  describe("Three-tier hierarchy ordering", () => {
    it("clock median > target median (GSE11923)", () => {
      expect(GSE11923.tiers.clock.median).toBeGreaterThan(
        GSE11923.tiers.target.median,
      );
    });

    it("target median > background median (GSE11923)", () => {
      expect(GSE11923.tiers.target.median).toBeGreaterThan(
        GSE11923.tiers.background.median,
      );
    });

    it("Arntl |λ| > Dbp |λ| (GSE54650 liver)", () => {
      expect(GSE54650_LIVER.arntl.lambda).toBeGreaterThan(
        GSE54650_LIVER.dbp.lambda,
      );
    });

    it("Arntl |λ| > Dbp |λ| implies Arntl τ_c > Dbp τ_c", () => {
      expect(tauC(GSE54650_LIVER.arntl.lambda)).toBeGreaterThan(
        tauC(GSE54650_LIVER.dbp.lambda),
      );
    });
  });
});
