import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, BookOpen, Printer, AlignLeft, BookMarked } from "lucide-react";
import { EXTENDED_CHAPTERS } from "@shared/book-extended-chapters";
import { CONCISE_CHAPTER3_CONTENT, CONCISE_APPENDIX_C_CONTENT } from "@shared/book-chapters-core";

/* ─── SVG Figures ──────────────────────────────────────────────────────────── */

function FigEigenvalueHierarchy() {
  const bars = [
    { label: "Clock Genes", value: 0.67, color: "#3b82f6", n: "n = 8 core genes" },
    { label: "Target Genes", value: 0.53, color: "#10b981", n: "n = 4,218 genes" },
    { label: "Background", value: 0.41, color: "#6b7280", n: "n = 16,482 genes" },
  ];
  const W = 520, H = 220, margin = { left: 120, right: 60, top: 30, bottom: 40 };
  const innerW = W - margin.left - margin.right;
  const barH = 44, gap = 18;

  return (
    <figure className="book-figure">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-lg mx-auto">
        <text x={W / 2} y={18} textAnchor="middle" fontSize={11} fill="#94a3b8" fontStyle="italic">
          Median |λ| across 22 datasets · 4 species
        </text>
        {bars.map((b, i) => {
          const y = margin.top + i * (barH + gap);
          const bw = b.value * innerW;
          return (
            <g key={b.label}>
              <text x={margin.left - 8} y={y + barH / 2 + 4} textAnchor="end" fontSize={12} fill="#e2e8f0" fontWeight="600">
                {b.label}
              </text>
              <rect x={margin.left} y={y} width={bw} height={barH} rx={4} fill={b.color} fillOpacity={0.85} />
              <rect x={margin.left} y={y} width={innerW} height={barH} rx={4} fill="none" stroke="#334155" strokeWidth={1} />
              <text x={margin.left + bw + 8} y={y + barH / 2 + 5} fontSize={13} fill={b.color} fontWeight="700">
                {b.value.toFixed(2)}
              </text>
              <text x={margin.left + bw + 50} y={y + barH / 2 + 5} fontSize={9} fill="#64748b">
                {b.n}
              </text>
            </g>
          );
        })}
        <line x1={margin.left} y1={H - margin.bottom + 5} x2={W - margin.right} y2={H - margin.bottom + 5} stroke="#334155" strokeWidth={1} />
        {[0, 0.2, 0.4, 0.6, 0.8, 1.0].map(v => (
          <g key={v}>
            <line x1={margin.left + v * innerW} y1={H - margin.bottom + 5} x2={margin.left + v * innerW} y2={H - margin.bottom + 10} stroke="#334155" />
            <text x={margin.left + v * innerW} y={H - margin.bottom + 22} textAnchor="middle" fontSize={9} fill="#64748b">{v.toFixed(1)}</text>
          </g>
        ))}
        <text x={W / 2} y={H - 2} textAnchor="middle" fontSize={10} fill="#64748b">Eigenvalue Modulus |λ|</text>
      </svg>
      <figcaption><strong>Figure 1.1</strong> — The three-tier eigenvalue hierarchy. Clock genes maintain consistently higher temporal persistence (|λ| = 0.67) than their downstream targets (0.53) and background genes (0.41). The clock-vs-background gap holds in all 22 datasets, 4 species, and 12 tissue types tested; the full three-tier ordering holds in most tissues.</figcaption>
    </figure>
  );
}

function FigRootSpace() {
  const W = 340, H = 300, cx = 170, cy = 155, R = 110;
  const points = [
    { x: cx + R * 0.62 * Math.cos(-0.9), y: cy + R * 0.62 * Math.sin(-0.9), label: "Clock", color: "#3b82f6" },
    { x: cx + R * 0.53 * Math.cos(-0.7), y: cy + R * 0.53 * Math.sin(-0.7), label: "Target", color: "#10b981" },
    { x: cx + R * 0.41 * Math.cos(-1.1), y: cy + R * 0.41 * Math.sin(-1.1), label: "BG", color: "#6b7280" },
  ];
  return (
    <figure className="book-figure">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-xs mx-auto">
        <text x={W / 2} y={16} textAnchor="middle" fontSize={11} fill="#94a3b8" fontStyle="italic">AR(2) Root-Space — Unit Disk</text>
        <circle cx={cx} cy={cy} r={R} fill="none" stroke="#334155" strokeWidth={1.5} strokeDasharray="4 4" />
        <circle cx={cx} cy={cy} r={2} fill="#475569" />
        {[0.25, 0.5, 0.75].map(r => (
          <circle key={r} cx={cx} cy={cy} r={R * r} fill="none" stroke="#1e293b" strokeWidth={1} />
        ))}
        <line x1={cx - R - 14} y1={cy} x2={cx + R + 14} y2={cy} stroke="#334155" strokeWidth={1} />
        <line x1={cx} y1={cy - R - 14} x2={cx} y2={cy + R + 14} stroke="#334155" strokeWidth={1} />
        <text x={cx + R + 16} y={cy + 4} fontSize={9} fill="#475569">Re</text>
        <text x={cx + 4} y={cy - R - 8} fontSize={9} fill="#475569">Im</text>
        {[0.25, 0.5, 0.75, 1.0].map(r => (
          <text key={r} x={cx + R * r + 3} y={cy - 3} fontSize={8} fill="#475569">{r.toFixed(2)}</text>
        ))}
        {points.map(p => (
          <g key={p.label}>
            <circle cx={p.x} cy={p.y} r={7} fill={p.color} fillOpacity={0.85} />
            <circle cx={p.x} cy={p.y} r={7} fill="none" stroke="white" strokeWidth={0.8} />
            <text x={p.x + 11} y={p.y + 4} fontSize={10} fill={p.color} fontWeight="600">{p.label}</text>
          </g>
        ))}
        <text x={W / 2} y={H - 6} textAnchor="middle" fontSize={9} fill="#475569">Complex eigenvalue plane · |λ| = distance from origin</text>
      </svg>
      <figcaption><strong>Figure 2.1</strong> — Root-space geometry. Each gene is represented as a point in the complex eigenvalue plane. Stable oscillators (|λ| &lt; 1) lie inside the unit disk. Clock genes cluster at higher radii than targets, reflecting stronger temporal memory. Points outside the unit disk would represent explosive, non-stationary dynamics.</figcaption>
    </figure>
  );
}

function FigCrossSpecies() {
  const species = ["Mouse\n(GSE11923)", "Human\n(GSE113883)", "Baboon\n(GSE98965)", "Arabidopsis\n(GSE242964)"];
  const categories = ["Clock", "Target", "BG"];
  const data = [
    [0.67, 0.54, 0.42],
    [0.63, 0.51, 0.40],
    [0.66, 0.53, 0.41],
    [0.61, 0.50, 0.38],
  ];
  const colors = ["#3b82f6", "#10b981", "#6b7280"];
  const W = 480, H = 240, margin = { left: 110, right: 20, top: 40, bottom: 50 };
  const innerW = W - margin.left - margin.right;
  const barGroupW = (innerW / species.length);
  const barW = barGroupW / (categories.length + 1);

  return (
    <figure className="book-figure">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-lg mx-auto">
        <text x={W / 2} y={16} textAnchor="middle" fontSize={11} fill="#94a3b8" fontStyle="italic">Clock &gt; Target &gt; Background holds across all species</text>
        {data.map((row, si) => (
          row.map((val, ci) => {
            const x = margin.left + si * barGroupW + ci * (barW + 2) + 6;
            const barH = (val - 0.3) / 0.7 * (H - margin.top - margin.bottom);
            const y = H - margin.bottom - barH;
            return (
              <g key={`${si}-${ci}`}>
                <rect x={x} y={y} width={barW} height={barH} rx={2} fill={colors[ci]} fillOpacity={0.8} />
                <text x={x + barW / 2} y={y - 3} textAnchor="middle" fontSize={7} fill={colors[ci]}>{val.toFixed(2)}</text>
              </g>
            );
          })
        ))}
        <line x1={margin.left} y1={H - margin.bottom} x2={W - margin.right} y2={H - margin.bottom} stroke="#334155" />
        {species.map((sp, i) => (
          <text key={i} x={margin.left + i * barGroupW + barGroupW / 2} y={H - margin.bottom + 14} textAnchor="middle" fontSize={9} fill="#94a3b8">
            {sp.split("\n")[0]}
          </text>
        ))}
        {species.map((sp, i) => (
          <text key={`sub${i}`} x={margin.left + i * barGroupW + barGroupW / 2} y={H - margin.bottom + 24} textAnchor="middle" fontSize={7.5} fill="#64748b">
            {sp.split("\n")[1]}
          </text>
        ))}
        {categories.map((cat, i) => (
          <g key={cat}>
            <rect x={margin.left + i * 55} y={H - 14} width={10} height={8} rx={2} fill={colors[i]} fillOpacity={0.8} />
            <text x={margin.left + i * 55 + 13} y={H - 7} fontSize={9} fill={colors[i]}>{cat}</text>
          </g>
        ))}
        <text x={14} y={H / 2} fontSize={9} fill="#64748b" transform={`rotate(-90, 14, ${H / 2})`} textAnchor="middle">|λ|</text>
      </svg>
      <figcaption><strong>Figure 3.1</strong> — Cross-species replication. The three-tier hierarchy (Clock &gt; Target &gt; Background) replicates independently across four phylogenetically diverse species using completely separate datasets. No parameter re-fitting was performed between species.</figcaption>
    </figure>
  );
}

function FigPhaseGating() {
  const W = 480, H = 200, mx = 30, my = 30;
  const iW = W - mx * 2, iH = H - my * 2;
  const pts = (phase: number, amp: number, decay: number) =>
    Array.from({ length: 200 }, (_, i) => {
      const t = i / 199;
      const x = mx + t * iW;
      const y = my + iH / 2 - amp * Math.sin(2 * Math.PI * t + phase) * Math.exp(-decay * t) * (iH / 2 - 8);
      return `${x},${y}`;
    }).join(" ");

  return (
    <figure className="book-figure">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-lg mx-auto">
        <text x={W / 2} y={16} textAnchor="middle" fontSize={11} fill="#94a3b8" fontStyle="italic">Phase-gating: clock constrains when targets can activate</text>
        <line x1={mx} y1={my + iH / 2} x2={W - mx} y2={my + iH / 2} stroke="#1e293b" strokeWidth={1} />
        <polyline points={pts(0, 1.0, 0)} fill="none" stroke="#3b82f6" strokeWidth={2.5} />
        <polyline points={pts(Math.PI * 0.4, 0.6, 0)} fill="none" stroke="#10b981" strokeWidth={1.8} strokeDasharray="4 2" />
        <polyline points={pts(Math.PI * 0.9, 0.35, 0)} fill="none" stroke="#6b7280" strokeWidth={1.4} strokeDasharray="2 3" />
        <text x={W - mx - 5} y={my + 14} textAnchor="end" fontSize={10} fill="#3b82f6" fontWeight="600">Clock (|λ|=0.67)</text>
        <text x={W - mx - 5} y={my + 28} textAnchor="end" fontSize={10} fill="#10b981">Target (|λ|=0.53)</text>
        <text x={W - mx - 5} y={my + 42} textAnchor="end" fontSize={10} fill="#6b7280">Background (|λ|=0.41)</text>
        {[0, 0.25, 0.5, 0.75, 1.0].map((t, i) => (
          <text key={i} x={mx + t * iW} y={H - 6} textAnchor="middle" fontSize={9} fill="#475569">{(t * 24).toFixed(0)}h</text>
        ))}
        <text x={W / 2} y={H - 0} textAnchor="middle" fontSize={9} fill="#475569">Time (hours)</text>
      </svg>
      <figcaption><strong>Figure 5.1</strong> — Phase-gating concept. Clock genes (blue) oscillate with high persistence and set the temporal reference frame. Target genes (green) are phase-locked to this reference — they can only activate within clock-permissive windows. Background genes (grey) show weak, essentially unconstrained oscillation. The phase offset between clock and target is the "gate" that Paper E quantifies across 28,138 gene pairs.</figcaption>
    </figure>
  );
}

function FigHalfLife() {
  const seed = (n: number) => { let x = Math.sin(n) * 10000; return x - Math.floor(x); };
  const dots = Array.from({ length: 120 }, (_, i) => ({
    x: seed(i * 7.3) * 0.95 + 0.025,
    y: seed(i * 3.7 + 100) * 0.85 + 0.075,
  }));
  const W = 300, H = 260, mx = 40, my = 30;
  const iW = W - mx * 2, iH = H - my - 40;

  return (
    <figure className="book-figure">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-xs mx-auto">
        <text x={W / 2} y={16} textAnchor="middle" fontSize={10} fill="#94a3b8" fontStyle="italic">mRNA half-life vs. eigenvalue modulus</text>
        <rect x={mx} y={my} width={iW} height={iH} fill="#0f172a" rx={3} />
        {dots.map((d, i) => (
          <circle key={i} cx={mx + d.x * iW} cy={my + (1 - d.y) * iH} r={2.5} fill="#3b82f6" fillOpacity={0.35} />
        ))}
        <line x1={mx} y1={my + iH * 0.5} x2={mx + iW} y2={my + iH * 0.5} stroke="#ef4444" strokeWidth={1.5} strokeDasharray="5 3" />
        <text x={mx + iW - 5} y={my + iH * 0.5 - 5} textAnchor="end" fontSize={8.5} fill="#ef4444">ρ = 0.012 (p = 0.31)</text>
        <line x1={mx} y1={my + iH} x2={mx + iW} y2={my + iH} stroke="#334155" />
        <line x1={mx} y1={my} x2={mx} y2={my + iH} stroke="#334155" />
        {[0, 0.5, 1.0].map(v => (
          <g key={v}>
            <text x={mx + v * iW} y={my + iH + 14} textAnchor="middle" fontSize={8} fill="#64748b">{(v * 20).toFixed(0)}h</text>
            <text x={mx - 6} y={my + (1 - v) * iH + 3} textAnchor="end" fontSize={8} fill="#64748b">{v.toFixed(1)}</text>
          </g>
        ))}
        <text x={W / 2} y={H - 16} textAnchor="middle" fontSize={9} fill="#64748b">mRNA half-life</text>
        <text x={12} y={my + iH / 2} fontSize={9} fill="#64748b" transform={`rotate(-90,12,${my + iH / 2})`} textAnchor="middle">|λ|</text>
        <text x={W / 2} y={H - 4} textAnchor="middle" fontSize={8} fill="#475569">n = 23,118 genes · GSE11923 liver series</text>
      </svg>
      <figcaption><strong>Figure 6.1</strong> — Half-life independence. Eigenvalue modulus (|λ|) shows essentially zero correlation with mRNA half-life across 23,118 genes (ρ = 0.012, p = 0.31). This rules out the confound that the AR(2) signature is merely tracking transcript stability rather than clock-driven temporal persistence.</figcaption>
    </figure>
  );
}

function FigFibonacci() {
  const W = 420, H = 240;
  const rules = [
    { rule: "q² = 1 - q", par: "φ₂ = −φ₁²", color: "#f59e0b" },
    { rule: "Self-similar growth", par: "ω = 2π/24", color: "#a78bfa" },
    { rule: "Divergence angle ↔ ω", par: "Period constraint", color: "#34d399" },
    { rule: "Apical → basal decay", par: "Damping: |λ| < 1", color: "#fb7185" },
    { rule: "Compartment renewal", par: "φ₁ + φ₂ = 1 − 1/φ²", color: "#38bdf8" },
  ];
  return (
    <figure className="book-figure">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-lg mx-auto">
        <text x={W / 2} y={16} textAnchor="middle" fontSize={11} fill="#94a3b8" fontStyle="italic">Boman (2017) crypt rules → PAR(2) parameter space</text>
        <rect x={10} y={26} width={180} height={H - 36} rx={6} fill="#1e293b" stroke="#334155" />
        <rect x={230} y={26} width={180} height={H - 36} rx={6} fill="#1e293b" stroke="#334155" />
        <text x={100} y={44} textAnchor="middle" fontSize={11} fill="#94a3b8" fontWeight="700">Boman Rules</text>
        <text x={320} y={44} textAnchor="middle" fontSize={11} fill="#94a3b8" fontWeight="700">PAR(2) Parameters</text>
        {rules.map((r, i) => {
          const y = 62 + i * 34;
          return (
            <g key={i}>
              <rect x={16} y={y - 11} width={168} height={24} rx={4} fill={r.color} fillOpacity={0.12} stroke={r.color} strokeOpacity={0.3} />
              <text x={100} y={y + 4} textAnchor="middle" fontSize={9.5} fill={r.color}>{r.rule}</text>
              <rect x={236} y={y - 11} width={168} height={24} rx={4} fill={r.color} fillOpacity={0.12} stroke={r.color} strokeOpacity={0.3} />
              <text x={320} y={y + 4} textAnchor="middle" fontSize={9.5} fill={r.color}>{r.par}</text>
              <path d={`M 184 ${y} L 230 ${y}`} fill="none" stroke={r.color} strokeWidth={1.5} markerEnd="url(#arrow)" strokeOpacity={0.7} />
            </g>
          );
        })}
        <defs>
          <marker id="arrow" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" fill="#475569" />
          </marker>
        </defs>
        <text x={207} y={H - 8} textAnchor="middle" fontSize={9} fill="#64748b">Boman q² = 1−q condition → multiple PAR(2) constraints → same parameter zone</text>
      </svg>
      <figcaption><strong>Figure 7.1</strong> — The Boman–PAR(2) bridge. Boman's 2017 paper establishes q ≈ 0.618 from asymmetric cell division (c = 2). Boman's 2025 five-rule tissue code generates five independent PAR(2) parameter constraints — all converging on the same φ-proximity zone (|λ| ≈ 1/φ ≈ 0.618). This five-fold algebraic convergence is the central claim of Paper G.</figcaption>
    </figure>
  );
}

function FigCentralPeripheral() {
  // GSE54650, 16 clock genes (Rorb set). Ordered lowest→highest |λ|.
  const tissues = [
    { name: "Hypothalamus", lambda: 0.4691, color: "#f59e0b" },
    { name: "Cerebellum",   lambda: 0.5501, color: "#fb923c" },
    { name: "Brainstem",    lambda: 0.5964, color: "#f87171" },
    { name: "Sk. Muscle",   lambda: 0.6219, color: "#e879f9" },
    { name: "Liver",        lambda: 0.6413, color: "#c084fc" },
    { name: "Aorta",        lambda: 0.6535, color: "#a78bfa" },
    { name: "Br. Adipose",  lambda: 0.6627, color: "#818cf8" },
    { name: "Wh. Adipose",  lambda: 0.6655, color: "#60a5fa" },
    { name: "Adrenal",      lambda: 0.6821, color: "#38bdf8" },
    { name: "Heart",        lambda: 0.6978, color: "#34d399" },
    { name: "Kidney",       lambda: 0.7377, color: "#4ade80" },
    { name: "Lung",         lambda: 0.7966, color: "#86efac" },
  ];
  const W = 420, H = 260, mx = 100, my = 28;
  const iW = W - mx - 60, iH = H - my - 40;

  return (
    <figure className="book-figure">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-lg mx-auto">
        <text x={W / 2} y={16} textAnchor="middle" fontSize={11} fill="#94a3b8" fontStyle="italic">Central-to-peripheral eigenvalue gradient · Paper Q</text>
        {tissues.map((t, i) => {
          const y = my + (i / (tissues.length - 1)) * iH;
          const bw = ((t.lambda - 0.4) / 0.45) * iW;
          return (
            <g key={t.name}>
              <text x={mx - 8} y={y + 4} textAnchor="end" fontSize={10} fill={t.color} fontWeight={i === 0 || i === tissues.length - 1 ? "700" : "400"}>
                {t.name}
              </text>
              <rect x={mx} y={y - 8} width={bw} height={16} rx={3} fill={t.color} fillOpacity={0.75} />
              <text x={mx + bw + 6} y={y + 4} fontSize={10} fill={t.color} fontWeight="600">{t.lambda.toFixed(3)}</text>
            </g>
          );
        })}
        <line x1={mx} y1={my + iH + 12} x2={W - 60} y2={my + iH + 12} stroke="#334155" />
        {[0.4, 0.5, 0.6, 0.7, 0.8].map(v => {
          const x = mx + ((v - 0.4) / 0.45) * iW;
          return (
            <g key={v}>
              <line x1={x} y1={my + iH + 12} x2={x} y2={my + iH + 18} stroke="#334155" />
              <text x={x} y={my + iH + 28} textAnchor="middle" fontSize={8} fill="#64748b">{v.toFixed(1)}</text>
            </g>
          );
        })}
        <text x={mx + iW / 2} y={H - 4} textAnchor="middle" fontSize={9} fill="#64748b">Eigenvalue Modulus |λ| — light-driven synchronisation strength</text>
        <text x={mx - 5} y={my - 6} textAnchor="end" fontSize={8} fill="#f59e0b">← Central</text>
        <text x={mx - 5} y={my + iH + 6} textAnchor="end" fontSize={8} fill="#34d399">Peripheral →</text>
      </svg>
      <figcaption><strong>Figure 8.1</strong> — Central-to-peripheral clock hierarchy (GSE54650, 16 clock genes). Eigenvalue modulus increases monotonically from hypothalamus (|λ|=0.4691, τ_c=2.6 h) to lung (|λ|=0.7966, τ_c=8.8 h), a 3.33× τ_c lag ratio. This gradient encodes how strongly each tissue is directly entrained by light versus relying on humoral signals from more central tissues.</figcaption>
    </figure>
  );
}

/* ─── Chapter Background SVGs ─────────────────────────────────────────────── */

function BgFibonacci() {
  const b = Math.log(1.618) / (Math.PI / 2);
  const pts: string[] = [];
  for (let i = 0; i <= 280; i++) {
    const theta = (i / 280) * 5.2 * Math.PI;
    const r = 3.2 * Math.exp(b * theta);
    const x = 290 + r * Math.cos(theta + 0.4);
    const y = 320 - r * Math.sin(theta + 0.4);
    pts.push(i === 0 ? `M${x.toFixed(1)},${y.toFixed(1)}` : `L${x.toFixed(1)},${y.toFixed(1)}`);
  }
  // Fibonacci rectangle outlines
  const fibRects = [
    [200, 190, 89, 89], [289, 190, 55, 55], [289, 245, 34, 34],
    [255, 245, 21, 21], [255, 266, 13, 13], [268, 266, 8, 8],
    [268, 274, 5, 5], [273, 274, 3, 3],
  ];
  return (
    <svg aria-hidden style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', opacity: 0.28, zIndex: 0 }} viewBox="0 0 340 380" preserveAspectRatio="xMaxYMin meet">
      {fibRects.map(([x, y, w, h], i) => (
        <rect key={i} x={x} y={y} width={w} height={h} fill="none" stroke="#4a7fc1" strokeWidth="0.8" />
      ))}
      <path d={pts.join(' ')} fill="none" stroke="#4a7fc1" strokeWidth="1.4" strokeLinecap="round" />
      <text x={148} y={258} fontSize="88" fill="#4a7fc1" fontFamily="serif" opacity="0.35" fontStyle="italic">φ</text>
    </svg>
  );
}

function BgGeometry() {
  const cx = 220, cy = 130, r = 88;
  const gridStep = 32;
  const gridLines: React.ReactElement[] = [];
  for (let x = 20; x <= 330; x += gridStep)
    gridLines.push(<line key={`v${x}`} x1={x} y1={10} x2={x} y2={310} stroke="#334155" strokeWidth="0.5" />);
  for (let y = 10; y <= 310; y += gridStep)
    gridLines.push(<line key={`h${y}`} x1={20} y1={y} x2={330} y2={y} stroke="#334155" strokeWidth="0.5" />);
  const eigenDots = [
    { r: r * 0.67, angle: 0.48, color: "#3b82f6", size: 4.5 },
    { r: r * 0.53, angle: 0.62, color: "#10b981", size: 3.5 },
    { r: r * 0.41, angle: 0.30, color: "#6b7280", size: 3.0 },
    { r: r * 0.79, angle: 0.55, color: "#60a5fa", size: 3.5 },
  ];
  return (
    <svg aria-hidden style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', opacity: 0.28, zIndex: 0 }} viewBox="0 0 340 320" preserveAspectRatio="xMaxYMin meet">
      {gridLines}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#4a7fc1" strokeWidth="1.6" strokeDasharray="6 4" />
      <line x1={cx - r - 16} y1={cy} x2={cx + r + 16} y2={cy} stroke="#4a7fc1" strokeWidth="0.9" />
      <line x1={cx} y1={cy - r - 16} x2={cx} y2={cy + r + 16} stroke="#4a7fc1" strokeWidth="0.9" />
      <text x={cx + r + 20} y={cy + 4} fontSize="10" fill="#4a7fc1" fontFamily="serif">Re</text>
      <text x={cx + 4} y={cy - r - 20} fontSize="10" fill="#4a7fc1" fontFamily="serif">Im</text>
      {eigenDots.map((d, i) => (
        <circle key={i} cx={cx + d.r * Math.cos(d.angle)} cy={cy - d.r * Math.sin(d.angle)} r={d.size} fill={d.color} opacity="0.75" />
      ))}
      <polygon points={`${cx - r},${cy + r} ${cx + r},${cy + r} ${cx},${cy - r / 2}`} fill="none" stroke="#4a7fc1" strokeWidth="0.9" strokeDasharray="4 3" opacity="0.5" />
    </svg>
  );
}

function BgBiological() {
  const W = 340, amp = 46, period = 72, cx = W - 60;
  const strand1Pts: string[] = [], strand2Pts: string[] = [];
  const rungs: React.ReactElement[] = [];
  for (let i = 0; i <= 440; i += 3) {
    const x1 = cx + amp * Math.sin((2 * Math.PI * i) / period);
    const x2 = cx - amp * Math.sin((2 * Math.PI * i) / period);
    const cmd = i === 0 ? 'M' : 'L';
    strand1Pts.push(`${cmd}${x1.toFixed(1)},${i}`);
    strand2Pts.push(`${cmd}${x2.toFixed(1)},${i}`);
    if (i % (period / 2) < 3.5 && i > 0) {
      rungs.push(<line key={i} x1={x1.toFixed(1)} y1={i} x2={x2.toFixed(1)} y2={i} stroke="#7fa8d4" strokeWidth="1.2" strokeLinecap="round" />);
    }
  }
  return (
    <svg aria-hidden style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', opacity: 0.28, zIndex: 0 }} viewBox="0 0 340 440" preserveAspectRatio="xMaxYMin meet">
      <path d={strand1Pts.join(' ')} fill="none" stroke="#3b82f6" strokeWidth="1.8" strokeLinecap="round" />
      <path d={strand2Pts.join(' ')} fill="none" stroke="#10b981" strokeWidth="1.8" strokeLinecap="round" />
      {rungs}
    </svg>
  );
}

function ChapterBackground({ type }: { type: 'fibonacci' | 'geometry' | 'biological' }) {
  if (type === 'fibonacci') return <BgFibonacci />;
  if (type === 'geometry') return <BgGeometry />;
  return <BgBiological />;
}

/* ─── Book Content ─────────────────────────────────────────────────────────── */

const CHAPTERS = [
  {
    id: "preface",
    number: "Preface",
    bgType: "biological" as const,
    title: "On Finding the Second Number",
    content: `The question that started this was simple enough to fit in one line: if Fibonacci shows up in space, does it show up in time?

Fibonacci sequences are well documented in spatial biology — seed spirals, leaf arrangements, branching trees. The mathematics of efficient packing under physical pressure explains them cleanly. But the temporal equivalent — whether the rhythmic architecture of cell division and gene expression carries the same signature — was barely explored. And a second question followed immediately: if such a pattern exists in healthy tissue, does its disruption contribute to the loss of order we see in cancer?

Those two questions, posed together in June 2025, were the starting point. The circadian clock was the obvious bridge — it regulates division timing, coordinates asymmetric division in stem cell populations, and gates the cell cycle. Bruce Boman and colleagues had modelled, in 2017, how asymmetric division and maturation timing in cancer stem cell populations produce Fibonacci-like growth dynamics — that work was already known and was one of the threads that made the temporal question seem worth asking. One month after the hypothesis was written, Dr. Boman sent me his five-rules paper for colonic crypts directly — describing the biological mechanisms that would enforce precisely the dynamical structure the analysis was uncovering, from a completely independent direction, in real time. That convergence was not engineered.

That is the conceptual arc. The chronological one took longer. From September through December 2025, the primary metric was not eigenvalue modulus but discovery rate — the percentage of clock-target gene pairs reaching statistical significance for directional phase-gating. That phase produced real findings: Cry1→Wee1 as the only universally conserved gating relationship across tissues; APC mutation doubling gating rates before BMAL1 co-deletion collapsed them 17-fold. But discovery rate is a property of a dataset and a threshold, not of the biology itself. In January 2026, a flaw in the null model for the Fibonacci signal was identified — the null had included biologically impossible explosive processes, making a 48-fold enrichment look like 3%. Correcting it made the eigenvalue modulus the central metric rather than a diagnostic step. The PAR(2) framework was reframed around that number, and every result in this book follows from that pivot.

AR(2) autoregression was the tool — not because I was a time-series specialist, but because it was the simplest model that could measure temporal persistence: how strongly a gene's past constrains its present. The first result was an eigenvalue near 0.62 for Bmal1 in mouse intestinal organoids. Then liver. Then kidney. Then baboon. The number kept appearing. It is 1/φ — the reciprocal of the golden ratio. What follows is what that meant.`,
    figure: null,
  },
  {
    id: "prologue",
    number: "Prologue",
    bgType: "biological" as const,
    title: "The Clock That Was Only Half Described",
    content: `For more than three decades, circadian biology operated under a powerful and productive simplification: the clock is a transcriptional feedback loop. BMAL1 and CLOCK proteins bind E-box enhancers, drive expression of CRY and PER, which accumulate overnight, repress their own activators, and then degrade at dawn — resetting the cycle. The elegance of this molecular description earned its discoverers the 2017 Nobel Prize in Physiology or Medicine, and rightfully so.

But the Nobel story, compelling as it is, describes the mechanism without fully answering the question that matters most for biology and medicine: how much does the clock actually control the rest of the genome? Not qualitatively — "it oscillates" — but quantitatively: how strongly, and how persistently?

The dominant computational tools in chronobiology — JTK_CYCLE, cosinor regression, RAIN — were designed to answer a specific, well-posed binary question: does this gene oscillate significantly with a 24-hour period? They are exquisitely sensitive to that objective, and the decades of discovery they enabled made this next step possible. But by design, they are purpose-built for detection, not quantification. A gene with a fragile, easily disrupted rhythm and one whose oscillation is so deeply embedded in the regulatory network that perturbing any upstream regulator barely shifts it will receive comparable scores. These are meaningfully different biological realities, and the existing toolkit was never intended to distinguish between them.

We are only able to see this second dimension of clock control because the last three decades of research mapped the first — the molecular mechanism — so thoroughly. This book describes what the data reveal when a quantitative lens is added alongside the qualitative one. That lens turned out to be the eigenvalue of a second-order autoregressive process. What follows is how the idea was developed, stress-tested, and ultimately found to hold across species, tissues, diseases, and time scales that none of the original analyses were designed to address.`,
    figure: null,
  },
  {
    id: "ch1",
    number: "Chapter 1",
    bgType: "geometry" as const,
    title: "A Different Question",
    content: `The shift in framing was the hardest part. Chronobiology already had excellent answers to the question it was asking. What was needed was a complementary question — one that extended beyond binary detection toward continuous quantification of clock control strength.

The distinction becomes clear with a thought experiment. Imagine two genes, both showing a statistically significant 24-hour rhythm in a liver time-series dataset. Gene A: its rhythm is detectable but fragile — remove BMAL1, and within two cycles, the oscillation collapses entirely. Gene B: its rhythm persists for days after the clock is perturbed, decaying only slowly, because the regulatory constraints maintaining it are distributed across multiple pathways. Detection-based tools, designed for a different purpose, are not equipped to separate these cases. Yet intuitively, and biologically, they represent very different relationships to the clock.

What distinguishes them is temporal persistence — the degree to which the past state of the gene's expression constrains its future state. A highly persistent gene cannot easily escape its trajectory; it has strong regulatory memory. A weakly persistent gene is largely memoryless — its current state tells you little about where it will be tomorrow.

The mathematical language for this is the autoregressive model. If you model a gene's expression trajectory as an AR(2) process — where the current value depends on the previous two time points — the characteristic roots of that system are complex numbers whose modulus captures exactly what we want. An eigenvalue modulus |λ| near 1 means the system has long temporal memory: perturbations decay slowly, the trajectory is strongly self-referential. An |λ| near 0 means rapid forgetting: each observation is nearly independent of its predecessors.

The core hypothesis was therefore testable and specific: clock genes — the core transcriptional oscillators — should have systematically higher |λ| than their downstream targets, which in turn should have higher |λ| than background genes with no special relationship to circadian timing. If that hierarchy held across species and tissues, the eigenvalue was measuring something real.`,
    figure: <FigEigenvalueHierarchy />,
  },
  {
    id: "ch2",
    number: "Chapter 2",
    bgType: "geometry" as const,
    title: "The Mathematics of Memory",
    content: `The AR(2) model is among the simplest non-trivial time-series structures. For a gene with expression y(t) at time t, the model is: y(t) = φ₁·y(t−1) + φ₂·y(t−2) + ε(t), where φ₁ and φ₂ are the autoregressive coefficients and ε(t) is white noise. The characteristic equation is z² − φ₁z − φ₂ = 0, whose two roots λ₁ and λ₂ encode the entire dynamic personality of the process.

When the discriminant φ₁² + 4φ₂ < 0, the roots are complex conjugates — the gene oscillates. The oscillation frequency is determined by the argument of the complex root: ω = arctan(Im(λ)/Re(λ)). The decay rate — and therefore the persistence — is determined by the modulus |λ| = √(Re(λ)² + Im(λ)²). For a 24-hour rhythm sampled at 2-hour intervals, 12 time points complete one cycle, and a |λ| of 0.65 means the amplitude halves over roughly 1.7 cycles — about 40 hours.

The geometry of this becomes intuitive when plotted in the complex plane. Each gene's characteristic root is a point inside (stable) or outside (unstable) the unit disk. The radial distance from the origin is |λ|. Clock genes cluster at higher radii than targets — not randomly, but in a structured, reproducible way that reflects genuine biological hierarchy.

The stability triangle — the region of (φ₁, φ₂) parameter space where both roots are inside the unit disk — has three qualitatively distinct regimes: real positive roots (overdamped, monotone decay), real negative roots (alternating decay), and complex conjugate roots (oscillatory). Biological circadian genes fall almost exclusively in the complex oscillatory regime, confirming that we are measuring the right class of dynamics.

Fitting the AR(2) model to short time series (typically 12–48 points in circadian experiments) requires careful handling. The maximum likelihood estimator for φ₁ and φ₂ is biased for small samples, and standard errors must account for the autocorrelation structure. A battery of diagnostic checks — Ljung-Box residual tests, stationarity verification, Cramer's rule validation of coefficient estimates — was developed and applied to every gene in every dataset before any downstream analysis was performed.

The complex roots carry a second piece of information beyond |λ|: their argument ω = arctan(Im(λ)/Re(λ)) encodes the oscillation's phase at each time point. When a clock gene and its downstream target both produce complex-conjugate roots at the same frequency, their phase arguments can be compared directly. In healthy circadian tissue, clock genes and their E-box targets maintain a consistent phase offset — the target activates within a narrow clock-permissive window, cycle after cycle. This is phase-gating: the clock's high-persistence oscillation acts as a temporal gating signal, and the target gene's activation is constrained to occur only when the gate is open. The "P" in PAR(2) — Phase-Gated Autoregressive — names this relationship. Quantifying the fidelity of that gate, and measuring how disease erodes it, is the subject of the cancer chapter (Chapter 5) and the chronotherapy work that follows.`,
    figure: <FigRootSpace />,
  },
  {
    id: "ch3",
    number: "Chapter 3",
    bgType: "biological" as const,
    title: "The Discovery",
    content: CONCISE_CHAPTER3_CONTENT,
    figure: <FigCrossSpecies />,
  },
  {
    id: "ch4",
    number: "Chapter 4",
    bgType: "geometry" as const,
    title: "Is It Real or Noise?",
    content: `Every finding in computational biology must survive a sustained attempt at its own destruction. A hierarchy this clean, appearing across 22 publicly available datasets from independent laboratories (GEO accessions listed in the platform supplementary), inevitably raises the question: what confound could produce this pattern? The most obvious candidates were tested systematically.

Transcript half-life: if clock genes have unusually long-lived mRNAs, a simple stability effect could mimic temporal persistence. The correlation between |λ| and mRNA half-life across 23,118 genes was ρ = 0.012 (p = 0.31). The signal is orthogonal to stability. Expression level: high-abundance transcripts could have lower measurement noise and thus appear more persistent. The correlation between mean expression and |λ| was also negligible (ρ = 0.08). Sampling resolution: coarser time series might favour certain parameter ranges. Testing with synthetic data at multiple resolutions showed |λ| estimates were stable across 1h, 2h, and 4h sampling intervals.

The gap-classifier analysis asked a more pointed question: could a simple classifier trained on |λ| alone predict whether a gene is a clock target? Across a held-out test set, area under the ROC curve was 0.74 — well above chance but well below perfect, which is exactly what a genuine but noisy biological signal should look like. The confusion matrix showed that false negatives clustered in tissue-restricted targets (genes that are clock-controlled in specific tissues only), confirming that the eigenvalue is tissue-specific in the right way.

Rolling-window analysis addressed whether the hierarchy is a property of the full time series or appears spuriously in certain segments. Computing |λ| in consecutive 12-point windows across the 48h series, the clock/target gap remained stable across every window, confirming that the signal is not driven by a single outlier time segment. Stationarity testing with augmented Dickey-Fuller confirmed that greater than 94% of clock-classified genes met strict stationarity criteria across well-sampled tissues (range: 89%–98% across datasets; tissues with insufficient oscillation amplitude, such as bulk hypothalamus, were excluded from this calculation), validating the AR(2) model assumption in the datasets where it is applied.`,
    figure: null,
  },
  {
    id: "ch5",
    number: "Chapter 5",
    bgType: "biological" as const,
    title: "Cancer Breaks the Clock",
    content: `If eigenvalue modulus measures how deeply a gene is embedded in the circadian architecture, cancer — which systematically disrupts circadian output — should reduce it. This is the prediction tested in Paper E, across colorectal organoids, TCGA tumour data, and glioblastoma.

The organoid experiment used GSE157357, a four-condition dataset comparing wildtype, BMAL1-knockout, APC-knockout, and double-knockout intestinal organoids. APC-knockout — modelling the most common initiating mutation in colorectal cancer — produced a distinctive eigenvalue signature: the clock/target gap collapsed almost entirely, while double-knockout showed partial recovery of the gap through what appeared to be a compensatory mechanism. This "tug-of-war equilibrium" phenotype was not predicted in advance and represents one of the more surprising results in the dataset.

Phase-gating analysis quantified the temporal relationship between clock genes and their targets across 28,138 gene pairs. In healthy tissue, targets are phase-locked to clocks within a consistent window; in APC-KO, this phase coherence degrades measurably. The disease phase diagram — plotting the clock/target temporal correlation ratio across conditions — traces a trajectory from healthy (ratio 2.19×) through APC-KO (0.43×) in GSE157357 that is consistent with loss of circadian gating; independent replication in additional colorectal cancer datasets is needed to establish this ratio shift as a general feature of APC loss rather than a dataset-specific observation.

In the TCGA colorectal validation, 10 of 15 pre-specified clock genes showed concordant eigenvalue shifts between healthy adjacent tissue and matched tumour samples (expected under null: 7/8 would exceed this by chance at p = 0.035). The GBM immune clock analysis added a sobering note: in glioblastoma, NK cell circadian rhythm is not merely attenuated but appears non-existent — the GBM result is a true negative, a useful reminder that not all cancer-associated circadian changes are the same mechanism.`,
    figure: <FigPhaseGating />,
  },
  {
    id: "ch6",
    number: "Chapter 6",
    bgType: "biological" as const,
    title: "The Drug Question",
    content: `If eigenvalue modulus is to be useful for chronotherapy — optimising drug administration timing based on circadian control of target gene expression — one potential confound looms large: drug targets tend to have unusual biochemical properties, including, often, unusually long-lived proteins. If the eigenvalue were tracking protein half-life rather than circadian architecture, the entire clinical application would be compromised.

Paper F addressed this directly with the half-life independence test. Using published mRNA half-life measurements for 23,118 genes from metabolic labelling experiments in mouse liver (the same tissue and series used for eigenvalue computation), the Spearman correlation between |λ| and half-life was ρ = 0.012, with a p-value of 0.31 — not merely non-significant but essentially zero in effect size.

The analysis was extended to protein half-life data for the subset of ~6,400 genes with proteomics measurements. The correlation was ρ = 0.021, again negligible. Drug targets — defined by three independent databases — showed no elevation in half-life relative to their |λ| values compared with non-target genes. The eigenvalue signal is orthogonal to stability in the thermodynamic sense; it measures something independent.

Before/after comparisons in drug perturbation experiments confirmed the biological interpretation. Computationally identified chronotherapy candidate genes — defined by high |λ|, clock-gated phase relationships, and annotated therapeutic relevance in existing databases, but not yet experimentally validated as chronotherapy targets — showed predictable eigenvalue shifts after pharmacological clock disruption, confirming that the signal changes when circadian architecture changes. This orthogonality-under-perturbation, combined with the half-life independence result, establishes that |λ| is measuring temporal embeddedness rather than stability.`,
    figure: <FigHalfLife />,
  },
  {
    id: "ch7",
    number: "Chapter 7",
    bgType: "fibonacci" as const,
    title: "Fibonacci in the Gut",
    content: `Paper G — published in revised form as "A Time-Domain Analogue to Fibonacci Structure via Phase-Gated AR(2) Dynamics" — is a reply to a two-paper framework by Bruce M. Boman and colleagues. The 2017 paper (*The Fibonacci Quarterly*, Vol. 55, No. 5) established the mathematical foundation: asymmetric cell division with maturation delay c = 2 produces Fibonacci number sequences, and the steady-state ratio of mature to immature cells satisfies q² = 1 − q, giving q ≈ 0.618 — the reciprocal of the golden ratio φ.

The 2025 paper (*Biology of the Cell*, 117:e70017) extended this into a five-rule tissue code. The five rules are: **Rule 1** — timing of cell division is based on a fixed cell cycle duration; **Rule 2** — temporal order: M cells divide every cycle, I cells only after maturation period c; **Rule 3** — spatial direction: the division angle rotates by a fixed increment each cycle (function of c), inherited by each daughter cell; **Rule 4** — number of cell divisions: limited by whole-maturation time nwm (function of generation g); **Rule 5** — cell lifespan L (birth to death). Agent-based simulations driven by these rules produce emergent geometric structures that reproduce human colonic crypt organisation, including Fibonacci cell counts per branch.

A critical clarification addressed in the revision: the exact Fibonacci point (φ₁, φ₂) = (1, 1) lies outside the AR(2) stationarity triangle, with dominant root |λ| = φ ≈ 1.618 > 1. No covariance-stationary gene-expression series can operate there; all observed gene eigenvalues satisfy |λ| < 1. The Fibonacci connection is therefore a geometric boundary landmark of the admissible parameter space, not an attainable operating point. The biologically relevant reference is the stable twin of the Fibonacci characteristic polynomial, 1/φ ≈ 0.618, which lies well inside the stationarity region. Boman's five rules are the biological mechanisms that hold the crypt system in the heavily damped sub-unit-root regime near this boundary.

As a proof-of-concept, phase-ordered AR(2) was fitted to four crypt-relevant genes from the GSE157357 WT organoid dataset (z-scored log-expression). Limitation: Boman's tissue code was developed for human large intestinal crypts; Stokes et al. used mouse small intestinal organoids — a species and anatomical region difference that means these fits are a proof-of-concept demonstration, not a validated quantitative test.

| Gene | Roots | Max |r| | Stability |
|---|---|---|---|
| Lgr5 | 0.049 ± 0.332j | 0.336 | Stable |
| Arntl (Bmal1) | 0.623 ± 0.551j | 0.832 | Stable |
| Per2 | −0.092 ± 0.513j | 0.521 | Stable |
| Axin2 | −0.008 ± 0.464j | 0.464 | Stable |

All four genes yield stable complex-conjugate roots. Arntl (Bmal1) shows high temporal persistence (|r| = 0.832), consistent with its role as the core circadian driver that must sustain phase coherence across many renewal cycles. The remaining three genes are substantially more damped, sitting in the heavily-damped sub-unit-root regime that Boman's five rules enforce. Fibonacci structure is an attractor in coefficient space approached from below, not a target eigenvalue — and Arntl's position near 1/φ ≈ 0.618 in adjacent datasets is consistent with this boundary interpretation. Preliminary analysis of a human intestinal enteroid dataset (GSE161566, Rosselot et al. 2022, 14-gene E-box set) shows Fibonacci-proximate clustering significantly closer to the 1/φ boundary than expression-matched random sets (p = 0.030, permutation test), supporting extension to human tissue in subsequent work.`,
    figure: <FigFibonacci />,
  },
  {
    id: "ch8",
    number: "Chapter 8",
    bgType: "biological" as const,
    title: "From Brain to Periphery",
    content: `The mammalian circadian system is hierarchically organised. The suprachiasmatic nucleus (SCN) in the hypothalamus receives direct photic input from the retina and serves as the master pacemaker. It entrains peripheral clocks — in liver, lung, skin, heart, and other organs — through a combination of hormonal signals, autonomic innervation, and feeding cues. But the quantitative relationship between centrality in this hierarchy and eigenvalue modulus had never been measured.

Paper Q applied AR(2) eigenvalue analysis to 16 core clock genes across 12 mouse tissues from the Zhang et al. multi-tissue atlas (GSE54650). The result was a monotone increase from hypothalamus (|λ| = 0.469, τ_c = 2.6 h) to lung (|λ| = 0.797, τ_c = 8.8 h), with all three CNS tissues ranking below all nine peripheral tissues. The 3.33-fold lung–hypothalamus τ_c ratio (8.8 h / 2.6 h) provides a quantitative basis for the well-documented 7–14 day peripheral re-entrainment lag after transmeridian travel. Pre-registered cross-species replication in baboon (GSE98965, Mure et al.) confirmed the gradient with a directly isolated SCN: baboon SCN |λ| = 0.471 is indistinguishable from mouse hypothalamus |λ| = 0.469 across ≈30 million years of divergence; baboon lung τ_c / SCN τ_c = 1.53× (lung |λ| = 0.611, 14 stable genes; PER3 and NR1D2 excluded as unstable), consistent with the mouse result after sample-size correction.

The interpretation is counterintuitive at first glance: why would the master pacemaker — the most important circadian tissue — have the lowest eigenvalue? The answer emerges from the function of each tissue in the hierarchy. The SCN must be maximally entrained by external light — it needs to respond to environmental input, not ignore it. A very high |λ| would make it resistant to re-entrainment after, for example, seasonal changes or transmeridian travel. Peripheral tissues, conversely, should be resistant to transient noise in humoral signals; they need to maintain their temporal programme against fluctuating hormonal backgrounds. High |λ| in the periphery is not a failure of clock control — it is a design feature.

The retinal analysis added a post-hoc finding that was not pre-specified: OPN4 (melanopsin), the light-sensitive protein in intrinsically photosensitive retinal ganglion cells (ipRGCs), showed the lowest eigenvalue of any characterised phototransduction gene (|λ| = 0.389) — below even the background gene median, and strikingly lower than rod and cone genes (RHO, GNAT1, PDE6A), which sit in the clock-target range. This is counterintuitive at first glance but biologically coherent: rod and cone opsins are photosensory proteins that must maintain some temporal organisation while being regulated by the light environment, consistent with their intermediate persistence. OPN4-expressing ipRGCs do the opposite — OPN4 must respond to the current light exposure to trigger the phase shifts that drive circadian entrainment. For this function, temporal persistence would be counterproductive: the signal needs to be able to respond to the present light environment without being constrained by what it was doing an hour ago. Low persistence in OPN4 is the molecular signature of a light-sensitive reset switch, not a sustained integrator. The OPN4 result demonstrates that the eigenvalue correctly identifies functional outliers — genes whose biology requires low temporal persistence — even within gene families where most members show intermediate or high persistence.`,
    figure: <FigCentralPeripheral />,
  },
  {
    id: "ch9",
    number: "Chapter 9",
    bgType: "fibonacci" as const,
    title: "What This Changes",
    content: `The eigenvalue hierarchy is a measurement, not a therapy. But it points towards applications that were not visible from any previous vantage point in chronobiology.

Chronotherapy — adjusting drug dosing time to the circadian phase of the target — has been studied empirically for decades, with frustrating variability in results. The problem is that circadian phase varies between individuals, between tissues, and between healthy and disease states in ways that are hard to measure non-invasively. The eigenvalue offers a partial solution: genes with high |λ| maintain their phase relationships more robustly across these sources of variability. A drug target with |λ| = 0.79 is a better candidate for chronotherapy than one with |λ| = 0.43, because the high-|λ| target's phase can be predicted more reliably from an accessible proxy tissue. This is not a proof of concept — it is a prediction that can be tested prospectively.

The evolutionary gene age analysis, conducted using a five-tier phylostrata framework spanning universal genes (~3,500 Mya) through vertebrate-specific innovations (~450 Mya), found that biological role — not evolutionary antiquity — predicts |λ|. Vertebrate clock genes (TTFL assembled ~480 Mya) show the highest median |λ| of any phylostrata tier, despite being far younger than ancient ribosomal, glycolytic, and TCA-cycle genes (~3,500 Mya), which show constitutive low-oscillatory persistence with real AR(2) roots. Outside clock function, Spearman ρ ≈ 0 for age versus |λ| across non-clock phylostrata. The eigenvalue hierarchy reflects functional integration into the circadian TTFL circuit, not the age of the gene.

The Turing deep dive — perhaps the most speculative chapter of the ongoing work — asks whether the spatial patterns formed by reaction-diffusion systems (Turing patterns) and the temporal patterns maintained by AR(2) processes share a common mathematical substrate. Preliminary bifurcation analysis suggests that the parameter zone where AR(2) processes show maximal temporal persistence (|λ| ≈ 0.618–0.72) corresponds to the parameter zone where reaction-diffusion systems transition from pattern-forming to pattern-suppressing dynamics. If this correspondence is real rather than coincidental, it would suggest that biological systems operating near the golden ratio are exploiting a deep mathematical property of self-organisation at the edge of instability.

None of these downstream findings were planned at the outset. The platform was built to test a single hypothesis about a single number. The number has held up. What it is measuring — and what it will reveal as more datasets, more diseases, and more perturbations are fed through it — remains genuinely open.`,
    figure: null,
  },
  {
    id: "ch10",
    number: "Chapter 10",
    bgType: "biological" as const,
    title: "The Immune Clock",
    content: `The innate immune system is profoundly circadian. Macrophage phagocytic capacity, neutrophil recruitment, sepsis susceptibility, and vaccine immunogenicity all vary by time of day — effects traceable to direct CLOCK:BMAL1 regulation of Tlr9, Nlrp3, and the NF-κB pathway. Yet whether this temporal control is implemented through a stable eigenvalue architecture — a clock gating low-persistence effectors, as in the intestine and brain — had never been measured.

Application of PAR(2) to peritoneal macrophages (GSE25585; Keller et al., 2009; 22,105 probes, 12 timepoints at 4-hour intervals over 48 hours) reveals the expected eigenvalue hierarchy — but with a structural asymmetry not visible in metabolic tissues. After excluding unstable genes, 20,771 genes remain; the genome median is |λ| = 0.558. Clock genes as a panel (16 genes, mean |λ| = 0.762) sit well above genome background (permutation p < 0.0001). The clock-versus-background gap is intact, but the two arms of the TTFL are not equal.

The negative-arm repressors — PER1–3, CRY1–2, NR1D1–2 (REV-ERBα/β) — carry mean |λ| = 0.889, all ranked in the top 15% of the genome. The PAR-bZip output factors DBP, TEF, HLF follow at mean |λ| = 0.838. The positive-arm activators — CLOCK, ARNTL/BMAL1, RORα/β/γ — show mean |λ| = 0.576, statistically indistinguishable from genome background. The negative arm is 1.55× the positive arm; the gap of 0.313 is confirmed by permutation (p = 0.004). The highest-ranked clock gene is NR1D1 (REV-ERBα: |λ| = 0.978, rank #66 of 20,771); CLOCK sits at rank #14,707 (|λ| = 0.436) and RORα at rank #20,446 (|λ| = 0.144, bottom 1.5%). The clock-controlled target panel (23 genes, mean |λ| = 0.621) sits above genome background and below clock genes, preserving the expected ordering. This asymmetry is biologically coherent: REV-ERBα directly gates inflammatory gene programmes via continuous suppressive load on NF-κB target genes, requiring sustained self-reinforcing expression dynamics, while CLOCK and BMAL1 in macrophages appear to function more as permissive scaffolds than dynamic drivers.`,
    figure: null,
  },
  {
    id: "ch11",
    number: "Chapter 11",
    bgType: "geometry" as const,
    title: "The Protein Level",
    content: `A persistent question in circadian biology is whether transcript-level rhythms are faithfully translated to protein. Fewer than half of rhythmically expressed proteins are encoded by rhythmic mRNAs; post-translational dynamics can impose or erase temporal structure independently of transcription. The Fibonacci-proximate eigenvalue signal in mRNA data — if it is a genuine biological property — should survive translation and post-translational processing to appear at the protein level.

Circadian nuclear proteomics of mouse liver (Wang et al., 2018) across 28 clock gene–target protein pairings gives mean |λ| = 0.594 and mean Fibonacci proximity = 86.2%. All 28 pairs are Fibonacci-like or Near-Fibonacci. Protein-level FP values (mean 86.2%) are significantly higher than matched mRNA FP values from the same tissue (mean 64.6%; exact two-sample KS test D = 0.857, p = 0.008), consistent with post-translational stabilisation amplifying Fibonacci-proximate dynamics rather than attenuating them. The signal is not an artefact of transcript kinetics.

WEE1, the primary G2/M cell-cycle gate, is Fibonacci-like at the protein level (FP = 88.5%, |λ| = 0.689) — consistent across all four clock-gene predictors and with an eigenperiod of 12.6 hours, suggesting twice-daily gating. YAP1, the Hippo effector implicated in crypt cancer initiation, shows Near-Fibonacci protein dynamics (FP = 79.8%, |λ| = 0.493), consistent with its role as a conditionally sustained growth integrator. The PAR(2) temporal hierarchy is a post-translational reality.`,
    figure: null,
  },
  {
    id: "ch12",
    number: "Chapter 12",
    bgType: "biological" as const,
    title: "The Metabolic Clock",
    content: `Circadian clocks regulate glucose homeostasis at every level — β-cell insulin secretion, hepatic glucose production, peripheral insulin sensitivity. Clock gene polymorphisms in ARNTL, CLOCK, and CRY2 are associated with T2DM risk in GWAS; circadian misalignment substantially worsens metabolic outcomes. Yet continuous glucose monitor data — now routinely collected in clinical diabetes management — have never been analysed for temporal persistence structure.

AR(2) eigenvalue analysis of CGM time-series from the Shanghai T2DM dataset (Zhao et al. 2023; n = 10 participants spanning the glycaemic spectrum, multi-day 5-minute recordings) reveals exploratory, directionally consistent associations between Fibonacci proximity and glycaemic control status; subgroups show substantial overlap and heterogeneity. The pre-diabetic participant shows |λ| = 0.831 and FP = 92.8% — Fibonacci-like, comparable to the healthiest peripheral tissue clock genes. Well-controlled T2DM shows a bimodal distribution: one subgroup remains Fibonacci-like (FP = 92.5%); the other has already departed (FP = 47.7%). Uncontrolled T2DM ranges from 19.6% to 67.6%.

The gradient is not simply tracking mean glucose level. Two patients with similar mean glucose (~141–148 mg/dL) show a three-fold difference in Fibonacci proximity, suggesting that standard HbA1c and time-in-range metrics do not capture circadian-metabolic coupling status. The bimodal distribution in the well-controlled group is the most clinically provocative finding: two patients who appear metabolically equivalent by every standard metric are in substantially different states of circadian-metabolic coupling. One retains Fibonacci-proximate dynamics; the other does not. If the PAR(2) framework is correct, their long-term trajectories should diverge.

The mechanistic interpretation centres on REV-ERBα and BMAL1. In T2DM, elevated glucagon signalling chronically activates hepatic cAMP response elements, competing with and eventually suppressing REV-ERBα rhythms. As REV-ERBα oscillation weakens, its downstream target genes — including those involved in lipogenesis and gluconeogenesis — lose their clock-gated temporal autocorrelation. The glucose time-series reflects the integrated output of this entire network; |λ| captures whether that output retains the self-sustaining oscillatory structure of intact circadian-metabolic coupling.

AR(2) eigenvalue modulus of CGM data is therefore proposed as a practical index of circadian-metabolic coupling status — and potentially a leading biomarker of chronotherapeutic response, detectable before HbA1c changes because it measures regulatory architecture rather than mean glucose. Archived results: manuscripts/shanghai_t2dm_fibonacci.json.`,
    figure: null,
  },
  {
    id: "ch13",
    number: "Chapter 13",
    bgType: "fibonacci" as const,
    title: "Sleep and the Output Layer",
    content: `Sleep deprivation is the most common circadian disruption in human populations. Its molecular effect on the circadian system is well documented at the level of mean expression: Per1 and Per2 are acutely induced, reflecting homeostatic sleep pressure through the adenosine-mediated two-process model. But whether SD specifically disrupts the eigenvalue architecture — targeting the sustained output layer rather than the core pacemaker — has not been examined.

In 42 BXD recombinant inbred mouse strains under 6-hour sleep deprivation (Jan et al., 2019, GEO: GSE114845), the cortical expression pattern is highly selective: Per1 (+0.74 log2FC) and Per2 (+1.02 log2FC) rise sharply; Dbp falls (−0.36 log2FC); Bhlhe40 and Nfil3 — both PAR-bZip competitors — rise. The core negative feedback loop (Arntl, Cry1/2, Nr1d1/2) is essentially unchanged. Liver shows only marginal Per1 induction; hepatic clock dynamics are preserved, consistent with hepatic entrainment being driven primarily by feeding rather than homeostatic sleep pressure.

The BXD genetic architecture adds a dimension unavailable in single-strain studies. Across 42 strains, the magnitude of the Dbp suppression and Per2 induction varies substantially, reflecting natural genetic variation in the coupling between homeostatic sleep pressure and the PAR-bZip output arm. Strains with high sleep homeostatic pressure (short wake-bout duration under SD) show larger Dbp falls and Nfil3 rises — a tighter genetic correlation than that between SD response and TTFL gene changes. This suggests the PAR-bZip output coupling, not the pacemaker itself, is the primary target of natural variation in sleep need.

This pattern maps directly onto selective output-eigenvalue disruption: the pacemaker is intact; the sustained integrator output layer is clamped. The rapid 24-hour recovery of the molecular clock after recovery sleep follows naturally: the TTFL is undamaged and restores the output layer in one oscillatory cycle. Chronic sleep restriction, which eventually disrupts photic entrainment of the TTFL itself, would be predicted to cause more lasting and harder-to-recover eigenvalue collapse — a mechanistic distinction with direct clinical relevance for shift-work disorder.`,
    figure: null,
  },
  {
    id: "appendix-methods",
    number: "Appendix A",
    bgType: "geometry" as const,
    title: "Why Not Cosinor? PAR(2) in Context",
    content: `Every reader from the circadian field will ask: why not use cosinor / JTK_CYCLE / RAIN? The answer is that these methods are excellent — and used throughout this collection — but they answer a different question. Cosinor, JTK_CYCLE, and RAIN test whether a gene is rhythmic and what its period and phase are. PAR(2) tests how self-sustaining the gene's dynamics are. These are orthogonal quantities.

A gene can be highly rhythmic (large amplitude, clear 24h period, JTK q-value < 0.001) and have low eigenvalue modulus — if each oscillation requires external forcing rather than self-sustaining autocorrelation. A gene can have high |λ| without appearing rhythmic to cosinor — if its persistence is present but amplitude is low. The concrete example is Dbp under sleep deprivation: still detectable as rhythmic by amplitude-based methods, but predicted by the PAR(2) framework to have lost its sustained output coupling — which is exactly the functionally relevant disruption. Amplitude and persistence occupy independent axes; both are needed.

AR(2) is chosen over AR(1) because one memory lag cannot represent a damped oscillation; over AR(3)+ because short time-series (n=12–24) cannot support more parameters without overfitting. OLS is chosen over Bayesian estimation because it is computationally identical to maximum likelihood for Gaussian errors and requires no prior specification.

**Diagnostic thresholds a researcher should verify before trusting an eigenvalue:** (1) |λ| < 1 — if ≥ 5% of genes fail this, the data was not properly mean-centred; (2) Ljung-Box p > 0.05 at lag 6 — residual autocorrelation indicates model underspecification for that gene; (3) ADF test passed — unit root failure means the series has a trend the AR(2) cannot absorb; (4) eigenperiod between 18h and 30h for circadian datasets — values outside this range indicate the model is fitting noise rather than the circadian signal. Every gene in every dataset in this collection was checked against all four criteria before any downstream result was computed.`,
    figure: null,
  },
  {
    id: "appendix-glossary",
    number: "Appendix B",
    bgType: "geometry" as const,
    title: "Glossary",
    content: `AR(2): A second-order autoregressive model x_t = φ₁x_{t−1} + φ₂x_{t−2} + ε_t. The simplest model that can represent a damped oscillation. Used throughout this collection because it captures both persistence (φ₁) and curvature/oscillatory structure (φ₂) with only two parameters — the maximum practical complexity for n=12–24 time-point circadian datasets.

Eigenvalue modulus |λ|: The magnitude of the characteristic root of the AR(2) companion matrix. Ranges from 0 (no temporal persistence) to 1 (boundary of stationarity). The primary quantitative output of the PAR(2) framework. Invariant to mean expression level, mRNA half-life, and z-score normalisation.

Fibonacci proximity (FP): max(0, 100 − ||λ|−0.618|/0.618 × 100). How close an eigenvalue is to the stable Fibonacci boundary 1/φ ≈ 0.618. Fibonacci-like: FP ≥ 85%. Near-Fibonacci: 50–85%. Non-Fibonacci: < 50%.

PAR-bZip genes: DBP, TEF, HLF — transcription factors driven by CLOCK:BMAL1 that control hundreds of metabolic gene rhythms. The "sustained integrator output arm" of the circadian hierarchy.

Temporal persistence: The degree to which a gene's expression at time t is predicted by its recent history, quantified by |λ|. Distinct from amplitude, period, and mRNA half-life.

Gearbox hierarchy: Clock genes (high |λ|) constrain proliferation-related genes (moderate |λ|) which sit above genome background (low |λ|). Observed across 22 publicly available datasets from independent laboratories, four species (mouse, human, baboon, Arabidopsis), 12+ tissues. Direction of the hierarchy is consistent across all datasets; precise fold-differences are dataset-specific.`,
    figure: null,
  },
  {
    id: "appendix-example",
    number: "Appendix C",
    bgType: "geometry" as const,
    title: "A Worked Example",
    content: CONCISE_APPENDIX_C_CONTENT,
    figure: null,
  },
  {
    id: "ai-disclosure",
    number: "Author's Note",
    bgType: "biological" as const,
    title: "A Note on AI Assistance",
    content: `This work was developed with extensive use of large language model (LLM) tools — principally Claude (Anthropic), accessed via Replit — throughout 2025 and 2026. That use was substantial enough to require direct and specific disclosure, not a footnote.

**Platform and code.** The PAR(2) Discovery Engine was built with AI-assisted code generation. The mathematical algorithms (OLS fitting of AR(2) coefficients, eigenvalue computation, Ljung-Box diagnostics) are standard statistical methods; the AI's role was implementation and debugging, not mathematical invention.

**Writing and prose.** Substantial portions of this book were drafted with AI assistance. The scientific content — the claims, the biological interpretations, the readings of individual datasets — reflect my own analysis and judgment. The AI served as a writing collaborator, not a source of scientific conclusions.

**What AI did not do.** The datasets are public GEO data; the AI did not generate, select, or manipulate any data. The core scientific questions were posed by me, not suggested by AI. The numerical findings are computed live from real expression data and have been independently verified by external audit (July 2026).

**Why this disclosure exists.** A research monograph that is substantially AI-assisted in its prose and code, and does not say so, is not being transparent with its readers. The scientific question, the hypothesis, the dataset selection, the experimental design decisions, the biological interpretations, and the responsibility for the claims are mine. The implementation — the code that runs the analyses, the prose that explains them — was developed in close collaboration with AI tools. That collaboration made this work possible at the pace and scale at which it was done.

Michael Whiteside
Independent Researcher, Scotland, July 2026`,
    figure: null,
  },
  {
    id: "epilogue",
    number: "Epilogue",
    bgType: "fibonacci" as const,
    title: "A Living Book",
    content: `The PAR(2) Discovery Engine is not a companion to this book — it is the book's primary form. The 97 interactive pages of the platform are where every claim in these chapters can be examined, stress-tested, and extended with new data. The figures printed here are static snapshots of analyses that run live, against real datasets, whenever a reader navigates to them.

This creates an unusual situation in scientific publishing. Normally, a book freezes the state of knowledge at the moment of writing. This one does not. As new datasets are deposited in the Gene Expression Omnibus, as new diseases are characterised with circadian time series, as new papers engage with or challenge the PAR(2) framework, the platform updates — and so does the evidence base underlying every chapter.

Paper A (the core Methods and Validation paper) is in preparation. Paper G (the Boman reply, the Fibonacci chapter) is now published in The Fibonacci Quarterly (doi:10.1080/00150517.2026.2716122). The reviewers' questions centred on the mechanistic interpretation of the Floquet correspondence — the mathematical connection is clear, but the biological mechanism that would produce it remains hypothetical, and the revision addresses this directly. Papers E, F, and Q are in preparation. The work described here is not finished; it is in the middle of being tested by the scientific community.

The eigenvalue of a gene's temporal dynamics is a simple number — a single real value between 0 and 1, carrying a fraction of a bit of information. That such a number, computed from a half-century-old statistical model, applied to data collected by hundreds of laboratories for entirely different purposes, should reveal a consistent hierarchical structure across species and diseases and evolutionary timescales is, at minimum, interesting. Whether it is deeply true or beautifully wrong will be settled by experiment, not by argument. The platform exists so that anyone with a time-series dataset can begin the settling.

A particular acknowledgment is owed to Dr. Bruce M. Boman. His mathematical work on crypt tissue architecture — and his quiet encouragement at a formative moment in this project — made Chapter 7 possible and shaped the broader ambition of what a quantitative circadian framework might eventually reach.

This work rests entirely on the generosity of the scientific community. Every dataset analysed here was generated by researchers who chose to make their data publicly available — a choice that costs effort and yields no direct reward. The Hogenesch laboratory at the University of Pennsylvania, whose GSE11923 mouse liver dataset provided the first test of the eigenvalue hierarchy; the Salk Institute team behind the landmark baboon transcriptome (GSE98965); the Karpowicz laboratory whose intestinal organoid data (GSE157357) revealed the APC-KO eigenvalue signature; the Rosselot and Bhaskara groups; and dozens more — each deposited their data to the Gene Expression Omnibus trusting that someone, someday, would find a use for it. The NCBI and NIH infrastructure that maintains the GEO, freely accessible to any researcher anywhere, is one of the great quiet achievements of modern science. The open-source statistical and bioinformatics communities — R, Python, and the tools built on them — provided the computational substrate without which none of this analysis would have been possible. And the circadian biology community as a whole, whose decades of careful experimental work established the ground truth that the eigenvalue hierarchy could be tested against, deserve more credit than a methods paper can give them.`,
    figure: null,
  },
];

/* ─── Main Component ───────────────────────────────────────────────────────── */

export default function Book() {
  useEffect(() => {
    document.title = "Persistence — Temporal Persistence and the Biological Clock";
  }, []);

  const [mode, setMode] = useState<'concise' | 'extended'>('concise');

  const chapters = CHAPTERS.map(ch => {
    const ext = EXTENDED_CHAPTERS.find(e => e.id === ch.id);
    return { ...ch, contentExtended: ext?.contentExtended ?? ch.content, platformLinks: ext?.platformLinks };
  });

  const handlePrint = () => window.print();

  const triggerDownload = (url: string, filename: string) => {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.rel = "noopener";
    a.target = "_blank";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleDownloadDocx = () => triggerDownload("/api/book/download", "Persistence_PAR2_Book_Concise.docx");
  const handleDownloadExtended = () => triggerDownload("/api/book/download-extended", "Persistence_PAR2_Book_Extended.docx");
  const handleDownloadPdf = () => triggerDownload("/api/book/download-extended-pdf", "Persistence_PAR2_Book_Extended.pdf");

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&family=Crimson+Pro:ital,wght@0,400;0,500;0,600;1,400&family=JetBrains+Mono:wght@400;500&display=swap');

        .book-root {
          font-family: 'EB Garamond', 'Georgia', serif;
          background: #0a0e1a;
          color: #dde3f0;
          min-height: 100vh;
        }
        .book-cover {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background: radial-gradient(ellipse 80% 60% at 50% 40%, #0f1e4a 0%, #0a0e1a 70%);
          border-bottom: 1px solid #1e293b;
          position: relative;
          overflow: hidden;
          padding: 4rem 2rem;
        }
        .book-cover::before {
          content: '';
          position: absolute;
          inset: 0;
          background: url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%231e3a5f' fill-opacity='0.12'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");
          pointer-events: none;
        }
        .book-series { font-size: 0.78rem; letter-spacing: 0.25em; text-transform: uppercase; color: #4a7fc1; margin-bottom: 1.2rem; font-family: 'Crimson Pro', serif; }
        .book-title { font-size: clamp(2.4rem, 6vw, 4.2rem); font-weight: 700; color: #e8edf8; text-align: center; line-height: 1.15; letter-spacing: -0.01em; margin-bottom: 0.6rem; }
        .book-subtitle { font-size: clamp(1rem, 2.5vw, 1.4rem); color: #7fa8d4; font-style: italic; text-align: center; margin-bottom: 2.2rem; font-family: 'Crimson Pro', serif; }
        .book-author { font-size: 1.05rem; color: #94a3b8; letter-spacing: 0.05em; margin-bottom: 3rem; }
        .book-meta { display: flex; gap: 2rem; flex-wrap: wrap; justify-content: center; font-size: 0.82rem; color: #475569; font-family: 'Crimson Pro', serif; }
        .book-meta span { border: 1px solid #1e3a5f; padding: 0.3rem 0.9rem; border-radius: 4px; background: #0f172a; }
        .book-toolbar { position: sticky; top: 0; z-index: 40; background: rgba(10,14,26,0.95); backdrop-filter: blur(12px); border-bottom: 1px solid #1e293b; padding: 0.6rem 2rem; display: flex; align-items: center; gap: 1rem; justify-content: space-between; }
        .book-toolbar-title { font-size: 0.85rem; color: #475569; font-family: 'EB Garamond', serif; font-style: italic; }
        .book-toolbar-actions { display: flex; gap: 0.6rem; }
        .book-toc { max-width: 680px; margin: 4rem auto; padding: 0 1.5rem; }
        .book-toc h2 { font-size: 1.1rem; letter-spacing: 0.15em; text-transform: uppercase; color: #4a7fc1; margin-bottom: 1.5rem; font-family: 'Crimson Pro', serif; font-weight: 500; }
        .book-toc-entry { display: flex; align-items: baseline; gap: 0; margin-bottom: 0.55rem; cursor: pointer; }
        .book-toc-entry:hover .book-toc-label { color: #7fa8d4; }
        .book-toc-number { font-size: 0.8rem; color: #334155; width: 100px; flex-shrink: 0; font-family: 'Crimson Pro', serif; }
        .book-toc-label { font-size: 1.0rem; color: #94a3b8; flex: 1; font-family: 'EB Garamond', serif; }
        .book-toc-dots { flex: 1; border-bottom: 1px dotted #1e293b; margin: 0 0.5rem 3px; min-width: 20px; }
        .book-body { max-width: 680px; margin: 0 auto; padding: 0 1.5rem 6rem; }
        .book-chapter { margin-bottom: 6rem; scroll-margin-top: 80px; position: relative; overflow: hidden; isolation: isolate; }
        .book-chapter > *:not(svg) { position: relative; z-index: 1; }
        .book-chapter-number { font-size: 0.78rem; letter-spacing: 0.2em; text-transform: uppercase; color: #4a7fc1; margin-bottom: 0.4rem; font-family: 'Crimson Pro', serif; }
        .book-chapter-title { font-size: clamp(1.6rem, 4vw, 2.4rem); font-weight: 600; color: #c8d8f0; line-height: 1.2; margin-bottom: 1.8rem; border-bottom: 1px solid #1e293b; padding-bottom: 1rem; }
        .book-chapter p { font-size: 1.1rem; line-height: 1.82; color: #c8d4e8; margin-bottom: 1.4rem; text-align: justify; hyphens: auto; }
        .book-chapter p:first-of-type::first-letter { font-size: 3.2rem; font-weight: 700; float: left; line-height: 0.82; margin: 0.12rem 0.12rem 0 0; color: #4a7fc1; font-family: 'EB Garamond', serif; }
        .book-figure { background: #0f172a; border: 1px solid #1e293b; border-radius: 8px; padding: 1.2rem 1rem 0.8rem; margin: 2.2rem 0; }
        .book-figure figcaption { font-size: 0.85rem; color: #64748b; margin-top: 0.8rem; line-height: 1.55; font-family: 'Crimson Pro', serif; font-style: italic; }
        .book-figure figcaption strong { font-style: normal; color: #7fa8d4; font-size: 0.88rem; }
        .book-subsection { font-size: 1.15rem; font-weight: 600; color: #7fa8d4; margin: 2.6rem 0 0.9rem; font-family: 'EB Garamond', serif; letter-spacing: 0.01em; line-height: 1.3; }
        .book-divider { text-align: center; color: #1e3a5f; letter-spacing: 0.5em; font-size: 0.9rem; margin: 3rem 0; user-select: none; }
        .book-epigraph { min-height: 70vh; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 6rem 3rem; text-align: center; border-bottom: 1px solid #1e293b; }
        .book-epigraph-ornament { font-size: 1.4rem; color: #1e3a5f; margin-bottom: 3.5rem; letter-spacing: 0.5em; }
        .book-epigraph-quote { font-size: clamp(1.05rem, 2.4vw, 1.3rem); font-style: italic; color: #8a9cbd; max-width: 520px; line-height: 1.9; margin-bottom: 1.6rem; font-family: 'EB Garamond', serif; }
        .book-epigraph-attribution { font-size: 0.88rem; color: #475569; font-family: 'Crimson Pro', serif; letter-spacing: 0.04em; margin-bottom: 4rem; }
        .book-epigraph-symbols { font-size: 1.8rem; color: #2d5a9e; letter-spacing: 0.8rem; font-family: 'EB Garamond', serif; }
        .book-footer { text-align: center; font-size: 0.8rem; color: #1e3a5f; border-top: 1px solid #1e293b; padding: 2rem; font-family: 'Crimson Pro', serif; }
        .book-platform-links { margin: 1.8rem 0 0.5rem; border-left: 2px solid #2d4a7a; padding: 0.75rem 1.1rem; background: rgba(14,22,42,0.55); border-radius: 0 4px 4px 0; }
        .book-platform-links-header { font-size: 0.68rem; letter-spacing: 0.22em; text-transform: uppercase; color: #4a7fc1; margin-bottom: 0.55rem; font-family: 'Crimson Pro', serif; font-weight: 500; }
        .book-platform-link { display: block; font-size: 0.9rem; color: #5b8fc7; text-decoration: none; font-family: 'Crimson Pro', serif; line-height: 1.6; }
        .book-platform-link::before { content: '→  '; color: #334155; }
        .book-platform-link:hover { color: #93c5fd; text-decoration: underline; }

        @media print {
          .book-toolbar, .no-print { display: none !important; }
          .book-root { background: white; color: #111; }
          .book-cover { background: white; color: #111; min-height: auto; padding: 3cm 2cm; page-break-after: always; }
          .book-title { color: #111; font-size: 36pt; }
          .book-subtitle { color: #444; }
          .book-author { color: #333; }
          .book-meta span { border-color: #ccc; background: #f5f5f5; color: #444; }
          .book-series { color: #1a3a7a; }
          .book-chapter { page-break-before: always; }
          .book-chapter-number { color: #1a3a7a; }
          .book-chapter-title { color: #111; border-color: #ccc; }
          .book-chapter p { color: #222; font-size: 11pt; line-height: 1.7; }
          .book-chapter p:first-of-type::first-letter { color: #1a3a7a; }
          .book-figure { border-color: #ccc; background: #fafafa; }
          .book-figure figcaption { color: #444; }
          .book-figure figcaption strong { color: #1a3a7a; }
          .book-toc { page-break-after: always; }
          .book-toc h2 { color: #1a3a7a; }
          .book-toc-number { color: #888; }
          .book-toc-label { color: #333; }
          .book-footer { color: #888; border-color: #ccc; }
          .book-divider { color: #ccc; }
          .book-toolbar-title { display: none; }
        }
      `}</style>

      <div className="book-root">
        {/* Toolbar */}
        <div className="book-toolbar no-print">
          <div className="book-toolbar-title">
            <BookOpen size={14} className="inline mr-1.5 mb-0.5" />
            Persistence — Temporal Persistence and the Biological Clock
          </div>
          <div className="book-toolbar-actions">
            <div style={{ display: "flex", gap: "2px", background: "#1e293b", borderRadius: "6px", padding: "2px" }}>
              <Button
                size="sm"
                variant={mode === 'concise' ? "default" : "ghost"}
                className="h-7 gap-1 text-xs"
                style={mode === 'concise' ? { background: "#3b82f6", color: "white" } : { color: "#94a3b8" }}
                onClick={() => setMode('concise')}
                data-testid="button-mode-concise"
              >
                <AlignLeft size={12} /> Concise
              </Button>
              <Button
                size="sm"
                variant={mode === 'extended' ? "default" : "ghost"}
                className="h-7 gap-1 text-xs"
                style={mode === 'extended' ? { background: "#3b82f6", color: "white" } : { color: "#94a3b8" }}
                onClick={() => setMode('extended')}
                data-testid="button-mode-extended"
              >
                <BookMarked size={12} /> Extended
              </Button>
            </div>
            <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={handlePrint}>
              <Printer size={13} /> Print / Save PDF
            </Button>
            <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={handleDownloadDocx} data-testid="button-download-concise">
              <Download size={13} /> Concise (.docx)
            </Button>
            <Button size="sm" className="h-8 gap-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white" onClick={handleDownloadExtended} data-testid="button-download-extended">
              <Download size={13} /> Extended (.docx)
            </Button>
            <Button size="sm" className="h-8 gap-1.5 text-xs bg-emerald-700 hover:bg-emerald-800 text-white" onClick={handleDownloadPdf} data-testid="button-download-pdf">
              <Download size={13} /> Extended (.pdf)
            </Button>
          </div>
        </div>

        {/* Cover */}
        <div className="book-cover">
          <div className="book-series">PAR(2) Discovery Engine · Research Monograph</div>
          <h1 className="book-title">Persistence</h1>
          <p className="book-subtitle">Temporal Persistence and the Biological Clock</p>
          <p className="book-author">The PAR(2) Research Group · 2026</p>
          <div className="book-meta">
            <span>Paper A in preparation · Paper G published in The Fibonacci Quarterly</span>
            <span>Papers A · E · F · G · Q</span>
            <span>22 Datasets · 4 Species · 12 Tissues</span>
            <span>97 Interactive Analyses</span>
          </div>
        </div>

        {/* Epigraph */}
        <div className="book-epigraph">
          <div className="book-epigraph-ornament">✦</div>
          <p className="book-epigraph-quote">
            "The miracle of the appropriateness of the language of mathematics
            for the formulation of the laws of physics is a wonderful gift
            which we neither understand nor deserve."
          </p>
          <p className="book-epigraph-attribution">— Eugene Wigner, 1960</p>
          <div className="book-epigraph-symbols">λ · ω · τ</div>
        </div>

        {/* Table of Contents */}
        <div className="book-toc no-print">
          <h2>Contents</h2>
          <div style={{ fontSize: "0.75rem", color: "#4a7fc1", marginBottom: "1rem", fontFamily: "'Crimson Pro', serif", fontStyle: "italic" }}>
            {mode === 'concise' ? 'Concise Edition' : 'Extended Edition — Full Book-Chapter Length'}
          </div>
          {chapters.map(ch => (
            <div key={ch.id} className="book-toc-entry" onClick={() => document.getElementById(ch.id)?.scrollIntoView({ behavior: "smooth" })}>
              <span className="book-toc-number">{ch.number}</span>
              <span className="book-toc-label">{ch.title}</span>
            </div>
          ))}
        </div>

        <div className="book-divider no-print">· · ·</div>

        {/* Chapters */}
        <div className="book-body">
          {chapters.map((ch, idx) => {
            const body = mode === 'extended' ? ch.contentExtended : ch.content;
            return (
              <section key={ch.id} id={ch.id} className="book-chapter">
                {ch.bgType && <ChapterBackground type={ch.bgType} />}
                <div className="book-chapter-number">{ch.number}</div>
                <h2 className="book-chapter-title">{ch.title}</h2>
                {body.split("\n\n").map((para, i) => {
                  const t = para.trim();
                  if (t.startsWith("### ")) return <h3 key={i} className="book-subsection">{t.slice(4)}</h3>;
                  return <p key={i}>{t}</p>;
                })}
                {ch.figure}
                {mode === 'extended' && ch.platformLinks && ch.platformLinks.length > 0 && (
                  <div className="book-platform-links no-print">
                    <div className="book-platform-links-header">Platform Evidence</div>
                    {ch.platformLinks.map((link, li) => (
                      <a key={li} href={link.route} className="book-platform-link">{link.label}</a>
                    ))}
                  </div>
                )}
                {idx < chapters.length - 1 && <div className="book-divider">· · ·</div>}
              </section>
            );
          })}
        </div>

        <div className="book-footer">
          <p>Persistence: Temporal Persistence and the Biological Clock</p>
          <p>© 2026 · PAR(2) Discovery Engine · All analyses reproducible at <strong>par2discovery.replit.app</strong></p>
          <p className="mt-2 no-print" style={{ display: "flex", gap: "0.5rem", justifyContent: "center", flexWrap: "wrap" }}>
            <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs" onClick={handlePrint}>
              <Printer size={12} /> Save as PDF
            </Button>
            <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs" onClick={handleDownloadDocx}>
              <Download size={12} /> Concise (.docx)
            </Button>
            <Button size="sm" className="h-7 gap-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white" onClick={handleDownloadExtended}>
              <Download size={12} /> Extended (.docx)
            </Button>
            <Button size="sm" className="h-7 gap-1.5 text-xs bg-emerald-700 hover:bg-emerald-800 text-white" onClick={handleDownloadPdf}>
              <Download size={12} /> Extended (.pdf)
            </Button>
          </p>
        </div>
      </div>
    </>
  );
}
