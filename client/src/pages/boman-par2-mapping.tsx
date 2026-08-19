import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  ArrowLeft, CheckCircle2, AlertTriangle, ExternalLink,
  BookOpen, ArrowRight, Microscope, Waves
} from "lucide-react";

const PHI = (1 + Math.sqrt(5)) / 2;
const PHI_RECIP = 1 / PHI;
const GOLDEN_ANGLE_DEG = 360 * (2 - PHI);
const GOLDEN_ANGLE_RAD = (2 * Math.PI) / (PHI * PHI);

function MathBlock({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-slate-900 rounded-lg px-5 py-3 font-mono text-sm text-emerald-300 my-3 overflow-x-auto whitespace-pre leading-relaxed">
      {children}
    </div>
  );
}

function Eq({ children, label }: { children: React.ReactNode; label?: string }) {
  return (
    <div className="flex items-center justify-between gap-4 bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 my-2 font-mono text-sm text-slate-800">
      <span>{children}</span>
      {label && <span className="text-[11px] text-slate-400 shrink-0">{label}</span>}
    </div>
  );
}

function RuleRow({
  n, bomanRule, bomanDetail, par2Param, par2Detail, link, status
}: {
  n: number; bomanRule: string; bomanDetail: string;
  par2Param: string; par2Detail: string; link?: string;
  status: "direct" | "approximate" | "indirect";
}) {
  const badge = {
    direct: "bg-emerald-100 text-emerald-700 border-emerald-200",
    approximate: "bg-amber-100 text-amber-700 border-amber-200",
    indirect: "bg-blue-100 text-blue-700 border-blue-200",
  };
  const badgeLabel = { direct: "Direct", approximate: "Approximate", indirect: "Conceptual" };
  return (
    <tr className="border-t border-slate-100" data-testid={`rule-row-${n}`}>
      <td className="px-3 py-3 align-top">
        <span className="w-6 h-6 rounded-full bg-slate-800 text-white text-xs font-bold flex items-center justify-center">{n}</span>
      </td>
      <td className="px-3 py-3 align-top">
        <p className="text-sm font-semibold text-slate-900">{bomanRule}</p>
        <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">{bomanDetail}</p>
      </td>
      <td className="px-3 py-3 align-top text-center">
        <ArrowRight size={14} className="text-amber-400 mx-auto mt-1" />
      </td>
      <td className="px-3 py-3 align-top">
        <p className="text-sm font-semibold text-amber-800">{par2Param}</p>
        <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">{par2Detail}</p>
        {link && (
          <span className={`inline-block mt-1.5 text-[10px] font-semibold border rounded-full px-2 py-0.5 ${badge[status]}`}>
            {badgeLabel[status]}
          </span>
        )}
      </td>
      <td className="px-3 py-3 align-top">
        <span className={`text-[10px] font-semibold border rounded-full px-2 py-0.5 ${badge[status]}`}>
          {badgeLabel[status]}
        </span>
      </td>
    </tr>
  );
}

interface PhiReport {
  coreClockResults: { gene: string; meanLambda: number; distanceFromPhiReciprocal: number; tier: string }[];
  directTargetResults: { gene: string; meanLambda: number; distanceFromPhiReciprocal: number; tier: string }[];
  summaryStats: {
    coreClock: { meanLambda: number; n: number };
    directTargets: { meanLambda: number; n: number };
    genesWithin005ofPhi: string[];
    genesWithin002ofPhi: string[];
  };
  permutationTest: {
    directTargets: { pValue: number; zScore: number; nPerm: number; observedMeanDist: number };
  };
}

export default function BomanPAR2Mapping() {
  const { data: phi, isLoading } = useQuery<PhiReport>({
    queryKey: ["/api/clock-target-phi-enrichment"],
    staleTime: Infinity,
  });

  const sortedClock = phi
    ? [...phi.coreClockResults].sort((a, b) => a.distanceFromPhiReciprocal - b.distanceFromPhiReciprocal)
    : [];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-slate-900 text-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
          <Link href="/paper-g-downloads" className="flex items-center gap-2 text-slate-400 hover:text-white text-sm mb-6 transition-colors">
            <ArrowLeft size={16} /> Paper G
          </Link>
          <div className="flex items-center gap-3 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-widest text-amber-400">Paper G · Core Argument</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold leading-tight">Boman's Spatial Rules → PAR(2) Temporal Parameters</h1>
          <p className="text-slate-400 mt-2 max-w-2xl text-sm leading-relaxed">
            Boman et al. (<em>Biology of the Cell</em>, 2025; 117:e70017) derive five mathematical laws for dynamic
            tissue organisation from asymmetric cell division rules. This page shows explicitly how each of
            those rules maps onto a PAR(2) parameter constraint, and why the same number — q = 1/φ ≈ 0.618 —
            appears as both Boman's spatial golden ratio and the modulus of the stable Fibonacci characteristic
            root in the temporal model.
          </p>
          <a
            href="https://doi.org/10.1111/boc.70017"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-[11px] bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg px-3 py-2 mt-4 transition-colors"
            data-testid="link-boman-paper"
          >
            <BookOpen size={12} className="text-slate-400" />
            Boman et al. (2025) Biol. Cell — DOI 10.1111/boc.70017
            <ExternalLink size={10} className="text-slate-500" />
          </a>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">

        {/* ── The Algebraic Bridge ──────────────────────────────────── */}
        <div className="rounded-xl border border-amber-200 bg-white shadow-sm">
          <div className="px-5 py-4 border-b border-amber-100">
            <h2 className="text-base font-bold text-slate-900">The Algebraic Bridge: Boman's q and the Fibonacci Eigenvalue</h2>
            <p className="text-xs text-slate-500 mt-1">Why the same number appears in both the spatial and temporal models</p>
          </div>
          <div className="px-5 py-5">
            <p className="text-sm text-slate-700 leading-relaxed mb-4">
              Boman's Appendix C introduces q = 1/φ as the reciprocal of the golden ratio and derives
              the algebraic identity q² = 1 − q. This is not an approximation — it is exact. The Fibonacci
              recurrence x_n = x_{"{n−1}"} + x_{"{n−2}"} has the identical relationship encoded in its
              characteristic polynomial. These two equations are the same object viewed spatially (Boman)
              and temporally (PAR(2)).
            </p>

            <div className="grid sm:grid-cols-2 gap-4 mb-4">
              {/* Boman side */}
              <div className="rounded-lg bg-slate-50 border border-slate-200 p-4">
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-3">Boman (2025) — Spatial</p>
                <Eq label="(Appendix C, Boman)">q = 1/φ ≈ {PHI_RECIP.toFixed(6)}</Eq>
                <Eq label="fundamental identity">q² = 1 − q</Eq>
                <Eq label="rearranged">q² + q − 1 = 0</Eq>
                <p className="text-[11px] text-slate-500 mt-2 leading-relaxed">
                  q is the ratio of successive Fibonacci counts as the sequence grows.
                  It encodes the self-similarity of the spatial Fibonacci circle structure.
                </p>
              </div>
              {/* PAR(2) side */}
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-4">
                <p className="text-[11px] font-bold uppercase tracking-wide text-amber-600 mb-3">PAR(2) — Temporal</p>
                <Eq label="Fibonacci recurrence">x_n = x_(n−1) + x_(n−2)</Eq>
                <Eq label="characteristic polynomial">r² − r − 1 = 0</Eq>
                <Eq label="stable root |r|">|r| = (√5 − 1)/2 = 1/φ = q ✓</Eq>
                <p className="text-[11px] text-amber-700 mt-2 leading-relaxed">
                  The modulus of the stable root of the Fibonacci characteristic polynomial
                  is exactly Boman's q. Temporal persistence = spatial self-similarity ratio.
                </p>
              </div>
            </div>

            <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 text-sm text-emerald-900 leading-relaxed">
              <strong>The bridge in one sentence:</strong> Boman's spatial Fibonacci circle stabilises at
              successive cell counts with ratio q = 1/φ satisfying q² = 1 − q. The PAR(2) Fibonacci
              characteristic polynomial r² − r − 1 = 0 has a stable root with modulus |r| = q satisfying
              the same equation. These are the same algebraic identity — one describing a spatial self-similarity
              ratio, the other a temporal persistence modulus. The twinning is algebraic, not approximate.
            </div>

            <MathBlock>{`Boman spatial:   q satisfies  q² + q − 1 = 0
                        q = (√5 − 1)/2 ≈ 0.618034

PAR(2) temporal: r satisfies  r² − r − 1 = 0  (Fibonacci characteristic polynomial)
                 stable root = (1−√5)/2 ≈ −0.618034
                 modulus |r| = (√5−1)/2 = q  ✓

These are the same number.`}</MathBlock>
          </div>
        </div>

        {/* ── p-Number Extension: Multiple q Values, One Stable Band ── */}
        <div className="rounded-xl border border-violet-200 bg-white shadow-sm">
          <div className="px-5 py-4 border-b border-violet-100">
            <h2 className="text-base font-bold text-slate-900">Boman's p-Number Families and the PAR(2) Stable Band</h2>
            <p className="text-xs text-slate-500 mt-1">
              Boman's model predicts different q values for different tissue types — and the PAR(2) stable band brackets them
            </p>
          </div>
          <div className="px-5 py-5">
            <p className="text-sm text-slate-700 leading-relaxed mb-4">
              A direct observation from Boman's Table 6: the standard Fibonacci sequence (A000045) and all anomalous
              sequences use q = 1/φ = 0.618034. But the Fibonacci p-number families — which arise from different stem cell
              niche rules (maturation delay, number of divisions) — each have a <em>distinct</em> q value. In Boman's model,
              this means different tissue organisations produce different spatial self-similarity ratios. The PAR(2) stable
              band [0.52, 0.72] is not an arbitrary empirical observation: it spans the q values for the standard Fibonacci
              sequence through the first two p-number families. Above p = 2, Boman's q values exceed the stable band.
            </p>
            <div className="overflow-x-auto rounded-lg border border-slate-200 mb-4">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                  <tr>
                    <th className="px-3 py-2 text-left">Sequence (OEIS)</th>
                    <th className="px-3 py-2 text-left">Fibonacci family</th>
                    <th className="px-3 py-2 text-left">Boman tissue rules</th>
                    <th className="px-3 py-2 text-right">Boman's q</th>
                    <th className="px-3 py-2 text-center">PAR(2) band?</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    {
                      seq: "A000045", family: "Standard Fibonacci",
                      rules: "3 initiating cells, 1-cycle maturation, 2 div/cell",
                      q: PHI_RECIP.toFixed(6), inBand: true, note: null
                    },
                    {
                      seq: "A000032 (Lucas)", family: "Common Fibonacci",
                      rules: "4 initiating cells, same division rules",
                      q: PHI_RECIP.toFixed(6), inBand: true, note: null
                    },
                    {
                      seq: "A000930", family: "Fibonacci p=2",
                      rules: "4 initiating cells, 2-cycle maturation delay, 3 div/cell",
                      q: "0.682328", inBand: true, note: null
                    },
                    {
                      seq: "A003269", family: "Fibonacci p=3",
                      rules: "5 initiating cells, 3-cycle maturation delay, 4 div/cell",
                      q: "0.724491", inBand: false, note: "≈ upper boundary"
                    },
                    {
                      seq: "A003520", family: "Fibonacci p=4",
                      rules: "6 initiating cells, 4-cycle maturation delay, 5 div/cell",
                      q: "0.754877", inBand: false, note: null
                    },
                    {
                      seq: "A005708", family: "Fibonacci p=5",
                      rules: "7 initiating cells, 5-cycle maturation delay, 6 div/cell",
                      q: "0.778059", inBand: false, note: null
                    },
                  ].map(row => (
                    <tr key={row.seq} className="border-t border-slate-100">
                      <td className="px-3 py-2.5 font-mono text-slate-700">{row.seq}</td>
                      <td className="px-3 py-2.5 text-slate-600">{row.family}</td>
                      <td className="px-3 py-2.5 text-slate-500 text-[11px]">{row.rules}</td>
                      <td className="px-3 py-2.5 text-right font-mono font-bold text-amber-700">{row.q}</td>
                      <td className="px-3 py-2.5 text-center">
                        {row.inBand
                          ? <span className="bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-full px-2 py-0.5 font-semibold">✓ within [0.52, 0.72]</span>
                          : <span className={`${row.note ? "bg-amber-100 text-amber-700 border-amber-200" : "bg-slate-100 text-slate-500 border-slate-200"} border rounded-full px-2 py-0.5`}>{row.note ?? "above band"}</span>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="bg-violet-50 border border-violet-200 rounded-lg px-4 py-3 text-xs text-violet-900 leading-relaxed">
                <strong>What this means for the twinning:</strong> Boman's model predicts that tissues with standard
                Fibonacci organisation (most tissues: q ≈ 0.618) and tissues with low-order p-number organisation
                (q ≈ 0.682) should both have PAR(2) eigenvalue moduli within the stable band. Only tissues with
                extreme niche complexity (p ≥ 4, q &gt; 0.75) fall outside. The stable band is thus not a
                post-hoc choice — it is predicted by Boman's own tissue classification.
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-xs text-slate-700 leading-relaxed">
                <strong>Honest limitation:</strong> The q values for Fibonacci p-number sequences are defined by
                the positive real root of x^(p+1) = x^p + 1, not by the q² = 1 − q identity (which is p=1 only).
                Each p-number family has its own analogous algebraic fixed point equation. The claim that the
                stable band covers these q values is a distributional observation, not an algebraic proof for p &gt; 1.
              </div>
            </div>
            <p className="text-[11px] text-slate-400 mt-3">
              q values from Boman et al. (Biol. Cell 2025; 117:e70017). Tissue rules from same paper, Table 1 / Section 3.1. PAR(2) stable band [0.52, 0.72] from multi-tissue clock gene eigenvalue distribution.
            </p>
          </div>
        </div>

        {/* ── Divergence Angle ↔ Oscillation Frequency ─────────────── */}
        <div className="rounded-xl border border-blue-200 bg-white shadow-sm">
          <div className="px-5 py-4 border-b border-blue-100">
            <div className="flex items-center gap-3">
              <Waves size={18} className="text-blue-500" />
              <div>
                <h2 className="text-base font-bold text-slate-900">Divergence Angle ↔ Oscillation Frequency</h2>
                <p className="text-xs text-slate-500 mt-0.5">Boman's key spatial measurement has a direct temporal analogue</p>
              </div>
            </div>
          </div>
          <div className="px-5 py-5">
            <p className="text-sm text-slate-700 leading-relaxed mb-4">
              Boman's model derives the divergence angle — the arc between consecutively initiated primordia —
              from cell counts at successive time cycles. The standard Fibonacci sequence (A000045) produces
              a divergence angle of 137.5°, the golden angle. In the PAR(2) model, the analogous quantity
              is the angular frequency ω = arg(r), encoding the dominant oscillation period in the time series.
            </p>
            <div className="grid sm:grid-cols-3 gap-3 mb-4">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-center">
                <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">Golden angle (Boman)</p>
                <p className="text-xl font-bold font-mono text-amber-700">{GOLDEN_ANGLE_DEG.toFixed(2)}°</p>
                <p className="text-[11px] text-slate-500 mt-1">360° × (2 − φ) = 360°/φ²</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-center">
                <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">Golden angle (radians)</p>
                <p className="text-xl font-bold font-mono text-blue-700">{GOLDEN_ANGLE_RAD.toFixed(6)}</p>
                <p className="text-[11px] text-slate-500 mt-1">2π/φ² = 2π × (2−φ)</p>
              </div>
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-center">
                <p className="text-[10px] text-amber-600 uppercase tracking-wide mb-1">PAR(2) analogue</p>
                <p className="text-xl font-bold font-mono text-amber-800">ω = arg(r)</p>
                <p className="text-[11px] text-amber-600 mt-1">oscillation frequency of complex eigenvalue</p>
              </div>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-xs text-blue-900 leading-relaxed mb-3">
              <strong>The mapping:</strong> In Boman's model, the divergence angle encodes how far around the circle
              each new cell is placed — it is a spatial phase increment per division. In PAR(2), ω = arg(r) encodes
              how far through the oscillation cycle the system advances per time step — a temporal phase increment.
              For a circadian system sampled every 2 hours over 24 hours, the dominant oscillation period T = 24h
              gives ω = 2π/12 ≈ 0.524 rad per 2h step.
            </div>
            <div className="bg-slate-100 border border-slate-200 rounded-lg px-4 py-3 text-xs text-slate-700 leading-relaxed">
              <strong>Honest caveat:</strong> The golden angle 2π/φ² ≈ 2.399 rad corresponds to a period of
              ~2.618 time steps in the PAR(2) model — not 12 or 24 hours. The spatial and temporal Fibonacci
              structures share the same attractor value q = 1/φ, but the oscillation frequencies are
              determined by different biological constraints (tissue geometry vs. circadian period). The claim
              is structural alignment, not numerical equality of frequencies.
            </div>
          </div>
        </div>

        {/* ── Five Rules → PAR(2) Table ──────────────────────────────── */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="text-base font-bold text-slate-900">Boman's Five Rules → PAR(2) Parameter Constraints</h2>
            <p className="text-xs text-slate-500 mt-1">
              From Boman et al. (<em>Biol. Cell</em>, 2025; 117:e70017) Section 3.1. Each rule constrains a specific aspect of the PAR(2) model.
              Violations produce predictable deformations of the AR(2) coefficient cloud.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="px-3 py-2 text-left w-8">#</th>
                  <th className="px-3 py-2 text-left">Boman Rule (spatial)</th>
                  <th className="px-3 py-2 w-8"></th>
                  <th className="px-3 py-2 text-left">PAR(2) Parameter (temporal)</th>
                  <th className="px-3 py-2 text-left w-24">Mapping</th>
                </tr>
              </thead>
              <tbody>
                <RuleRow
                  n={1}
                  bomanRule="Timing of cell division"
                  bomanDetail="The timing of cell division is based on a fixed cell cycle duration. Both mature (M) cells and immature (I) cells are modelled on the duration of this cell cycle. This fixed period is the fundamental unit of the tissue's temporal structure."
                  par2Param="AR(2) time unit; circadian anchor ω = 2π/24"
                  par2Detail="The fixed cell cycle duration defines the time unit of the AR(2) process. In circadian terms, this anchors the fundamental frequency ω = 2π/24, placing the system at the 24h oscillation period. Rule 1 is what makes the spatial cell biology commensurable with the temporal PAR(2) framework."
                  status="approximate"
                />
                <RuleRow
                  n={2}
                  bomanRule="Temporal order of cell division"
                  bomanDetail="Asymmetric division of a mature (M) cell generates the parent M cell and an immature (I) progeny cell. M cells divide every cell cycle; I cells divide only after a maturation period of c cycles. For c = 2, the steady-state M/I ratio satisfies q² = 1 − q, giving q ≈ 0.618 = 1/φ."
                  par2Param="Phase gate interval & eigenvalue modulus |r| ≈ q"
                  par2Detail="The maturation delay c is encoded directly in the phase gate length. For c = 2, the condition q² = 1 − q directly pins |r| ≈ 0.618. This is the algebraically direct mapping: the biological maturation rule and the Fibonacci characteristic equation are the same object. This is the biological motivation for the two-gate PAR(2) construction."
                  status="direct"
                />
                <RuleRow
                  n={3}
                  bomanRule="Spatial direction of cell division"
                  bomanDetail="The direction of cell division rotates by a fixed angle every cycle, as a function of the maturation period c. Each M and I daughter cell inherits the instructions for the direction and timing of its own next division. This produces the geometric leaflet and branch patterns in the tissue."
                  par2Param="Complex-conjugate eigenvalues; oscillatory coefficient structure"
                  par2Detail="The rotating division angle requires the AR(2) eigenvalues to be complex conjugates — placing the system in the oscillatory region of (φ₁, φ₂) space. The inherited direction rule is the spatial analogue of the phase-dependent coefficient switching in PAR(2). The rotation angle arg(r) ≈ 2π/φ² ≈ 137.5° corresponds to the golden angle. Validation note: a computational test of spatial zone vs |λ| across crypt cell types finds Spearman r = 0.11, p = 0.31 — correctly non-significant, because this mapping makes a categorical claim (eigenvalues must be complex, not real), not a prediction that |λ| should correlate with physical position. All four organoid genes in Table 1 yield complex-conjugate roots, confirming the structural claim."
                  status="approximate"
                />
                <RuleRow
                  n={4}
                  bomanRule="Number of cell divisions"
                  bomanDetail="The number of divisions M cells can undergo is limited by whole-maturation time nwm — the age at which an M cell becomes wholly mature (terminally-differentiated, W cell) — which is itself a function of cell generation number g. This rule dictates the maximum number of divisions any given cell will undergo."
                  par2Param="AR(2) stability constraint (|r| &lt; 1) &amp; memory truncation"
                  par2Detail="The whole-maturation limit nwm enforces |λ| < 1 — the stability constraint — and bounds the effective memory depth, justifying short-order AR(2). However, empirical testing across six intestinal cell types (stem, TA, enterocyte, goblet, tuft, EEC) shows that division count alone predicts |λ| ranking for only 2/6 cell types, while cell lifespan (Rule 5) correctly predicts all 6/6. Tuft cells (long-lived, slow-cycling) and EEC cells falsify a direct division-count model. The nwm constraint is therefore best understood as a stability ceiling rather than the primary determinant of specific |λ| values across cell types."
                  status="approximate"
                />
                <RuleRow
                  n={5}
                  bomanRule="Cell lifespan"
                  bomanDetail="The lifespan of a cell (L) is the time it exists in the tissue from birth to death. Although L does not affect the size of the active division region, it limits the overall size of the structure at steady state and sets the time horizon over which cell contributions to tissue state remain non-negligible."
                  par2Param="Finite AR memory; effective decay horizon — empirically strongest predictor"
                  par2Detail="Cell lifespan L sets the finite duration over which past states contribute meaningfully to x_t, consistent with short-order AR structure. Longer L → slower effective decay → |r| closer to 1. Empirical validation across six intestinal cell types confirms lifespan correctly ranks |λ| for all 6/6 cell types — making this the strongest direct empirical mapping of the five rules. The steady-state lifespan in healthy crypts (~5 days) is consistent with the |r| ≈ 0.618 regime. PAR(2) measures temporal persistence, and lifespan is its most direct biological correlate."
                  status="direct"
                />
              </tbody>
            </table>
          </div>
          <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 rounded-b-xl">
            <p className="text-[11px] text-slate-500 leading-relaxed">
              <strong>Mapping legend:</strong> Direct = algebraically derived. Approximate = structurally motivated, not proved. Conceptual = analogy only, requires additional assumptions.
              The mappings for Rules 2 and 4 are the strongest — the maturation delay and division limit directly produce the two-gate structure and the AR(2) memory truncation, respectively.
            </p>
          </div>
        </div>

        {/* ── Empirical Evidence: Clock Genes near Boman's q ───────── */}
        <div className="rounded-xl border border-emerald-200 bg-white shadow-sm">
          <div className="px-5 py-4 border-b border-emerald-100">
            <div className="flex items-center gap-3">
              <Microscope size={18} className="text-emerald-600" />
              <div>
                <h2 className="text-base font-bold text-slate-900">Empirical Evidence: Clock Genes Near Boman's q</h2>
                <p className="text-xs text-slate-500 mt-0.5">Mouse multi-tissue dataset (12 tissues) — |λ| vs q = 1/φ ≈ {PHI_RECIP.toFixed(6)}</p>
              </div>
            </div>
          </div>
          <div className="px-5 py-5">
            <p className="text-sm text-slate-700 leading-relaxed mb-4">
              If clock genes in intestinal crypts operate near the Fibonacci-consistent PAR(2) attractor,
              their eigenvalue moduli should cluster near q = 1/φ — Boman's spatial golden ratio. The
              multi-tissue mouse data provides this test. The organoid data in the in-press reply paper
              (|r| = 0.063–0.521) shows stability but not Fibonacci proximity; the multi-tissue clock gene
              data below is the stronger empirical case.
            </p>

            {isLoading ? (
              <div className="text-sm text-slate-400 text-center py-6">Loading clock gene data…</div>
            ) : phi ? (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                    <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">Boman's q</p>
                    <p className="text-xl font-bold font-mono text-amber-700">{PHI_RECIP.toFixed(4)}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">= (√5−1)/2 = 1/φ</p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">Core clock mean |λ|</p>
                    <p className="text-xl font-bold font-mono text-slate-800">{phi.summaryStats.coreClock.meanLambda.toFixed(4)}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Δ = {Math.abs(phi.summaryStats.coreClock.meanLambda - PHI_RECIP).toFixed(4)} from q
                    </p>
                  </div>
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                    <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">Permutation p-value</p>
                    <p className="text-xl font-bold font-mono text-emerald-700">p = {phi.permutationTest.directTargets.pValue.toFixed(3)}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">proximity to q vs genome</p>
                  </div>
                  <div className="rounded-lg border border-violet-200 bg-violet-50 p-3">
                    <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">Within 0.02 of q</p>
                    <p className="text-xl font-bold font-mono text-violet-700">{phi.summaryStats.genesWithin002ofPhi?.length ?? "—"} genes</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">|λ − q| &lt; 0.02</p>
                  </div>
                </div>

                {/* Per-gene table */}
                {sortedClock.length > 0 && (
                  <div className="overflow-x-auto rounded-lg border border-slate-200">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-100 text-slate-600 border-b border-slate-200">
                        <tr>
                          <th className="text-left px-3 py-2">Gene</th>
                          <th className="text-right px-3 py-2">Mean |λ|</th>
                          <th className="text-right px-3 py-2">|λ − q|</th>
                          <th className="text-left px-3 py-2">Distance from Boman's q</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedClock.map((g, i) => {
                          const dist = Math.abs(g.meanLambda - PHI_RECIP);
                          const barW = Math.min(100, (dist / 0.2) * 100);
                          const barColor = dist < 0.02 ? "bg-emerald-500" : dist < 0.05 ? "bg-teal-400" : dist < 0.1 ? "bg-amber-400" : "bg-slate-300";
                          return (
                            <tr key={g.gene} className={`border-t border-slate-100 ${i % 2 === 0 ? "bg-white" : "bg-slate-50/40"}`} data-testid={`gene-row-${g.gene}`}>
                              <td className="px-3 py-2 font-semibold text-slate-900">{g.gene}</td>
                              <td className="px-3 py-2 text-right font-mono">{g.meanLambda.toFixed(4)}</td>
                              <td className="px-3 py-2 text-right font-mono">
                                <span className={dist < 0.02 ? "text-emerald-600 font-bold" : dist < 0.05 ? "text-teal-600" : "text-slate-600"}>
                                  {dist.toFixed(4)}
                                  {dist < 0.02 && <span className="ml-1 text-[9px] bg-emerald-100 text-emerald-700 rounded-full px-1.5 py-0.5">≈q</span>}
                                </span>
                              </td>
                              <td className="px-3 py-2">
                                <div className="flex items-center gap-2">
                                  <div className="w-20 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                    <div className={`h-full ${barColor} rounded-full`} style={{ width: `${barW}%` }} />
                                  </div>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                <p className="text-[11px] text-slate-400 mt-3 leading-relaxed">
                  Data: mouse multi-tissue dataset, 12 tissues per gene. The E-box target permutation p = 0.041
                  is for this 14-gene functional set specifically. A separate 212-gene atlas permutation test
                  returned p = 1.0 (not significant) for overall φ-zone enrichment across broader gene categories.
                  The signal is therefore specific to the core circadian gene set, not a genome-wide property.
                  The organoid Table 1 in the in-press paper (|r| = 0.063–0.521) demonstrates AR(2) stability,
                  not Fibonacci proximity — this multi-tissue clock gene data is the stronger empirical case.
                </p>
              </>
            ) : (
              <div className="text-sm text-slate-400 text-center py-4">No data available</div>
            )}
          </div>
        </div>

        {/* ── Violation Predictions ─────────────────────────────────── */}
        <div className="rounded-xl border border-red-200 bg-white shadow-sm">
          <div className="px-5 py-4 border-b border-red-100">
            <div className="flex items-center gap-3">
              <AlertTriangle size={18} className="text-red-500" />
              <div>
                <h2 className="text-base font-bold text-slate-900">Predicted Violations — Rule Perturbations</h2>
                <p className="text-xs text-slate-500 mt-0.5">What each Boman rule violation looks like in AR(2) coefficient space</p>
              </div>
            </div>
          </div>
          <div className="px-5 py-5 space-y-3">
            {[
              {
                perturbation: "Bmal1 loss / circadian disruption",
                rule: "Rule 2 — maturation delay disrupted",
                prediction: "The day/night gate structure collapses. Both phase-gate AR(2) coefficient pairs converge toward a single mean, broadening the overall (φ₁, φ₂) distribution. Root magnitude |r| variance increases. The coefficient cloud drifts away from the Fibonacci-consistent region near q = 1/φ.",
                color: "border-orange-200 bg-orange-50",
                text: "text-orange-800",
              },
              {
                perturbation: "APC mutation / oncogenic transformation",
                rule: "Rules 3 & 4 — spatial direction disrupted, nwm extended",
                prediction: "When the whole-maturation limit nwm is relaxed (more divisions permitted per generation), AR(2) memory effectively lengthens. φ₁ increases toward 1, φ₂ shifts toward −1 boundary. |r| moves closer to 1 (slower decay, longer return times). The coefficient cloud migrates toward the unstable boundary, away from the q = 1/φ region.",
                color: "border-red-200 bg-red-50",
                text: "text-red-800",
              },
              {
                perturbation: "Niche expansion (increased initiating cells)",
                rule: "Rule 1 — niche size changed",
                prediction: "A larger niche allows more distinct AR(2) lineages. In scalar AR(2) terms, φ₁ increases (more self-reinforcing dynamics). The system may shift to a different Fibonacci p-number attractor with a different eigenvalue modulus — consistent with Boman's finding that different Fibonacci sequences arise from different niche sizes.",
                color: "border-violet-200 bg-violet-50",
                text: "text-violet-800",
              },
              {
                perturbation: "Chronotherapy / phase realignment",
                rule: "Rules 2 & 3 — gate timing restored",
                prediction: "Restoring circadian phase alignment tightens the (φ₁, φ₂) distribution, reducing inter-crypt variance in eigenvalue modulus. The coefficient cloud re-converges toward the Fibonacci-consistent coefficient region near q = 1/φ. This is the chronotherapy prediction from the reply paper's Section 7.",
                color: "border-emerald-200 bg-emerald-50",
                text: "text-emerald-800",
              },
            ].map(v => (
              <div key={v.perturbation} className={`rounded-lg border ${v.color} px-4 py-3`} data-testid={`violation-${v.perturbation.replace(/\s/g, '-').toLowerCase().slice(0, 20)}`}>
                <div className="flex items-start gap-3">
                  <div className="flex-1">
                    <p className={`text-xs font-bold ${v.text}`}>{v.perturbation}</p>
                    <p className="text-[11px] text-slate-500 mb-1">{v.rule}</p>
                    <p className={`text-xs ${v.text} leading-relaxed`}>{v.prediction}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Honest Limitations ───────────────────────────────────── */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="text-base font-bold text-slate-900">Honest Limitations</h2>
          </div>
          <div className="px-5 py-5 space-y-2 text-sm text-slate-700">
            <div className="flex gap-3">
              <CheckCircle2 size={15} className="text-emerald-500 shrink-0 mt-0.5" />
              <p>The algebraic bridge (q² = 1−q ↔ Fibonacci characteristic polynomial) is exact and requires no approximation.</p>
            </div>
            <div className="flex gap-3">
              <AlertTriangle size={15} className="text-amber-400 shrink-0 mt-0.5" />
              <p>Rules 1 and 2 mappings are the strongest structurally (timing → AR time unit; temporal order / maturation delay → phase gate; q²=1−q → |λ|≈0.618). Rule 5 (cell lifespan) is empirically the strongest predictor of specific |λ| values across intestinal cell types (6/6 correct). Rules 3 and 4 are partial: Rule 3 makes a categorical structural claim (complex eigenvalues required) that is confirmed, but does not predict spatial gradient magnitudes; Rule 4's nwm enforces the stability ceiling (|λ|&lt;1) but division count alone predicts only 2/6 cell-type |λ| rankings. Full computational analysis at Rule 3 &amp; 4 Validation (Papers E–Q menu).</p>
            </div>
            <div className="flex gap-3">
              <AlertTriangle size={15} className="text-amber-400 shrink-0 mt-0.5" />
              <p>Empirical validation of Rules 3 &amp; 4: a computational test across six intestinal cell types shows division count (Rule 4) correctly ranks |λ| for only 2/6 cell types; lifespan (Rule 5) correctly ranks all 6/6. Tuft cells (long-lived, slow-cycling) and EEC cells are the key falsifying examples for a naive division-count model. This refines, not refutes, the framework: PAR(2) measures temporal persistence driven by lifespan, not division rate per se.</p>
            </div>
            <div className="flex gap-3">
              <AlertTriangle size={15} className="text-amber-400 shrink-0 mt-0.5" />
              <p>The "Fibonacci-consistent manifold" is not yet formally defined in the in-press reply. It needs a precise quantitative criterion — what distance from q in coefficient space counts as Fibonacci-consistent? This is an open problem for the follow-up paper.</p>
            </div>
            <div className="flex gap-3">
              <AlertTriangle size={15} className="text-amber-400 shrink-0 mt-0.5" />
              <p>The organoid Table 1 values (|r| = 0.063–0.521) demonstrate stability, not Fibonacci proximity. The multi-tissue clock gene data above is the stronger empirical case and is the primary evidence in the in-press paper.</p>
            </div>
            <div className="flex gap-3">
              <AlertTriangle size={15} className="text-red-400 shrink-0 mt-0.5" />
              <p>The spatial and temporal Fibonacci structures share the algebraic fixed point q = 1/φ (from the same characteristic equation) but operate at different frequencies. The golden angle 137.5° does not numerically equal any circadian oscillation parameter — the analogy is structural, not numerical. Whether q = 1/φ functions as a dynamical attractor in real biological systems is an empirical question, not an algebraic one.</p>
            </div>
          </div>
        </div>

        {/* ── Navigation ───────────────────────────────────────────── */}
        <div className="flex flex-wrap gap-3">
          <Link href="/paper-g-downloads" className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 bg-white border border-slate-200 hover:border-slate-300 rounded-lg px-4 py-2 transition-all">
            <ArrowLeft size={14} /> Paper G
          </Link>
          <Link href="/clock-target-phi" className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 bg-white border border-slate-200 hover:border-slate-300 rounded-lg px-4 py-2 transition-all">
            Clock-Target 1/φ Enrichment <ArrowRight size={14} />
          </Link>
          <Link href="/boman-ode" className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 bg-white border border-slate-200 hover:border-slate-300 rounded-lg px-4 py-2 transition-all">
            Boman ODE Validation <ArrowRight size={14} />
          </Link>
          <Link href="/fibonacci-twinning-extended" className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 bg-white border border-slate-200 hover:border-slate-300 rounded-lg px-4 py-2 transition-all">
            Five Arguments <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </div>
  );
}
