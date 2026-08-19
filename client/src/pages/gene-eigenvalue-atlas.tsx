import React, { useState, useMemo, useEffect } from "react";
import { Link, useSearch } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft, Download, Search, LayoutGrid, Info, X,
  Table2, Grid3x3, ChevronDown, ChevronUp,
  TrendingDown, TrendingUp, BookOpen, Users, GitCompare,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { getGeneTissueCaveat } from "@/lib/datasetCaveats";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTip,
  ResponsiveContainer, Cell, ReferenceLine,
} from "recharts";

interface AtlasEntry {
  gene: string;
  category: string;
  categoryLabel: string;
  categoryColor: string;
  tissue: string;
  organism: string;
  eigenvalue: number;
  phi1: number;
  phi2: number;
  r2: number;
  isComplex: boolean;
  period: number | null;
  phase: number | null;
  genomePercentile: number | null;
  diseaseDelta: number | null;
  qValue: number | null;
  explanation: string;
}

interface AtlasResponse {
  success: boolean;
  entries: AtlasEntry[];
  total: number;
  computedAt: number;
  datasetCaveats?: Record<string, string>;
}

// ── Gene profile lookup (description · canonical peak · role · citation) ───────
type GeneProfile = { desc: string; canonicalPeak: string | null; role: string; citation: string };
const GENE_PROFILES: Record<string, GeneProfile> = {
  // Core clock activators
  ARNTL:  { desc: 'BMAL1 — master transcriptional activator of the TTFL; heterodimerizes with CLOCK to drive E-box target genes.', canonicalPeak: 'CT0–4', role: 'Core clock activator', citation: 'Bunger et al., Cell 2000' },
  BMAL1:  { desc: 'BMAL1 — alias for ARNTL. Master transcriptional activator of the TTFL.', canonicalPeak: 'CT0–4', role: 'Core clock activator', citation: 'Bunger et al., Cell 2000' },
  CLOCK:  { desc: 'Core E-box transcription factor; heterodimerizes with BMAL1 to drive Per/Cry and output-gene transcription.', canonicalPeak: 'CT0–4', role: 'Core clock activator', citation: 'Takahashi et al., Nat Rev Neurosci 2017' },
  // Core clock repressors
  PER1:   { desc: 'Period 1 — repressor arm of the TTFL; protein accumulates at night and inhibits CLOCK:BMAL1 activity.', canonicalPeak: 'CT8–12', role: 'Core clock repressor', citation: 'Bae et al., PNAS 2001' },
  PER2:   { desc: 'Period 2 — primary circadian repressor; mutations cause familial advanced sleep-phase syndrome.', canonicalPeak: 'CT10–14', role: 'Core clock repressor', citation: 'Toh et al., Science 2001' },
  PER3:   { desc: 'Period 3 — accessory repressor; also implicated in sleep homeostasis independent of period length.', canonicalPeak: 'CT8–12', role: 'Core clock repressor', citation: 'Archer et al., Sci Transl Med 2010' },
  CRY1:   { desc: 'Cryptochrome 1 — co-repressor with PER proteins; determines period length (longer period in Cry1−/−).', canonicalPeak: 'CT12–16', role: 'Core clock repressor', citation: 'van der Horst et al., Nature 1999' },
  CRY2:   { desc: 'Cryptochrome 2 — co-repressor; Cry2−/− mice display a shorter circadian period (~22 h).', canonicalPeak: 'CT10–14', role: 'Core clock repressor', citation: 'Vitaterna et al., PNAS 1999' },
  // Stabilising loops
  NR1D1:  { desc: 'REV-ERBα — nuclear receptor repressor that silences BMAL1 transcription via RORE elements; core stabilising loop.', canonicalPeak: 'CT4–8', role: 'Stabilising repressor (REV-ERB loop)', citation: 'Preitner et al., Cell 2002' },
  NR1D2:  { desc: 'REV-ERBβ — paralog of REV-ERBα; together they ensure robust repression of BMAL1 and metabolic targets.', canonicalPeak: 'CT4–8', role: 'Stabilising repressor (REV-ERB loop)', citation: 'Bugge et al., Genes Dev 2012' },
  RORA:   { desc: 'RORα — nuclear receptor activator at RORE elements; competes with REV-ERB to maintain BMAL1 expression.', canonicalPeak: 'CT20–0', role: 'Stabilising activator (ROR loop)', citation: 'Sato et al., Cell 2004' },
  RORB:   { desc: 'RORβ — circadian activator enriched in SCN and brain; drives BMAL1 via RORE.', canonicalPeak: 'CT20–0', role: 'Stabilising activator (ROR loop)', citation: 'Sato et al., Cell 2004' },
  RORC:   { desc: 'RORγ — ROR paralog expressed in immune and metabolic tissues; activates BMAL1 and immune gene rhythms.', canonicalPeak: 'CT20–0', role: 'Stabilising activator (ROR loop)', citation: 'Sato et al., Cell 2004' },
  // PAR bZIP output
  DBP:    { desc: 'D-box Binding PAR-bZIP — primary PAR(2) target; peaks CT8–12 and drives xenobiotic/drug metabolism gene expression.', canonicalPeak: 'CT8–12', role: 'PAR bZIP output transcription factor', citation: 'Gachon et al., Cell 2006' },
  TEF:    { desc: 'Thyrotrophic Embryonic Factor — PAR bZIP family; redundant with DBP/HLF in driving output gene expression.', canonicalPeak: 'CT8–12', role: 'PAR bZIP output transcription factor', citation: 'Gachon et al., Cell 2006' },
  HLF:    { desc: 'Hepatic Leukemia Factor — PAR bZIP transcription factor; rhythmic output to amino acid catabolism.', canonicalPeak: 'CT8–12', role: 'PAR bZIP output transcription factor', citation: 'Gachon et al., Cell 2006' },
  NFIL3:  { desc: 'E4BP4 — anti-phase PAR bZIP repressor; expressed CT22–2, opposes DBP/TEF/HLF. Shows monotonically rising expression over 28h in the TimeSignature circadian profiling dataset (GSE113883); the mechanistic driver is not established from that dataset alone.', canonicalPeak: 'CT22–2', role: 'Anti-phase PAR bZIP repressor', citation: 'Mitsui et al., EMBO J 2001' },
  // Cell-cycle circadian targets
  WEE1:   { desc: 'WEE1 kinase — BMAL1-driven G2/M checkpoint; gates mitosis to circadian time of day.', canonicalPeak: 'CT8', role: 'Cell cycle circadian gate', citation: 'Matsuo et al., Science 2003' },
  MYC:    { desc: 'c-Myc — proto-oncogene under direct NR1D1 repression; circadian gating lost in clock-disrupted cancers.', canonicalPeak: 'CT16–20', role: 'Oncogenic circadian target', citation: 'Altman et al., Mol Cell 2015' },
  CCND1:  { desc: 'Cyclin D1 — G1/S cell cycle gate; expression deregulated in Per2-mutant mice.', canonicalPeak: null, role: 'Cell cycle circadian target', citation: 'Fu et al., Cell 2002' },
  // Wnt/stem circadian targets
  AXIN2:  { desc: 'Axin2 — Wnt pathway negative feedback inhibitor; rhythmically expressed in intestinal stem cells.', canonicalPeak: null, role: 'Wnt circadian target', citation: 'Stokes et al., JCMGH 2021' },
  LGR5:   { desc: 'Lgr5 — intestinal stem cell marker and Wnt co-receptor; circadian expression in intestinal crypts.', canonicalPeak: null, role: 'Wnt/stem cell circadian target', citation: 'Stokes et al., JCMGH 2021' },
  ASCL2:  { desc: 'Achaete-scute homolog 2 — stem cell transcription factor; circadian expression in intestinal epithelium.', canonicalPeak: null, role: 'Stem cell circadian target', citation: '' },
  // Signaling / non-stationary in blood
  NOTCH2: { desc: 'Notch 2 receptor — transmembrane receptor in stem cell niches; shows non-stationary (monotonically rising) expression over 28h in the TimeSignature circadian profiling dataset (Braun et al. 2018, PNAS, GSE113883; n=11 healthy adults). The study was designed for circadian state detection, not sleep deprivation; the driver of the monotonic trend is not established.', canonicalPeak: null, role: 'Notch signaling — non-stationary in 28h blood time series', citation: 'Braun et al., PNAS 2018 (PMID 30201705)' },
  PTCH1:  { desc: 'Patched 1 — Hedgehog pathway receptor; shows non-stationary (monotonically rising) expression over 28h in GSE113883 (TimeSignature study, Braun et al. 2018, PNAS; n=11 healthy adults, circadian profiling protocol).', canonicalPeak: null, role: 'Hedgehog signaling — non-stationary in 28h blood time series', citation: 'Braun et al., PNAS 2018 (PMID 30201705)' },
  JAG1:   { desc: 'Jagged 1 — Notch ligand; shows non-stationary (monotonically rising) expression over 28h in GSE113883 (TimeSignature study, Braun et al. 2018, PNAS; n=11 healthy adults, circadian profiling protocol).', canonicalPeak: null, role: 'Notch ligand — non-stationary in 28h blood time series', citation: 'Braun et al., PNAS 2018 (PMID 30201705)' },
  // Housekeeping
  ACTB:   { desc: 'β-Actin — cytoskeletal structural protein; standard normalization reference not expected to oscillate.', canonicalPeak: null, role: 'Housekeeping reference', citation: '' },
  GAPDH:  { desc: 'GAPDH — glycolytic enzyme; primary RT-qPCR housekeeping reference; used to assess oscillation absence.', canonicalPeak: null, role: 'Housekeeping reference', citation: '' },
  B2M:    { desc: 'β-2 Microglobulin — MHC class I component; housekeeping reference gene in blood studies.', canonicalPeak: null, role: 'Housekeeping reference', citation: '' },
  RPL13A: { desc: 'Ribosomal protein L13a — constitutively expressed ribosomal component; housekeeping control.', canonicalPeak: null, role: 'Housekeeping reference', citation: '' },
};

// Fallback description by category
const CAT_DESC: Record<string, string> = {
  clock:        'Core molecular clock gene — part of the transcription-translation feedback loop (TTFL) that generates ~24 h oscillations.',
  target:       'Clock-controlled target — transcriptionally driven by CLOCK:BMAL1 or its output factors (PAR bZIPs, REV-ERBs).',
  housekeeping: 'Housekeeping gene — constitutively expressed; expected |λ| near background (no circadian periodicity).',
  immune:       'Immune-regulated gene — expression gated by macrophage or lymphocyte clocks; interacts with inflammatory signalling.',
  metabolic:    'Metabolic gene — circadian control links feeding/fasting cycles to substrate metabolism.',
  chromatin:    'Chromatin/epigenetic regulator — rhythmic histone modifications or chromatin accessibility gates clock-controlled transcription.',
  signaling:    'Signalling pathway gene — circadian interaction with growth factor or developmental pathways.',
  dna_repair:   'DNA repair gene — time-of-day-gated repair capacity linked to circadian NER and BER pathways.',
  stem:         'Stem cell gene — circadian control of progenitor cell activity and tissue renewal.',
  other:        'Circadian-associated gene — included in panel for cross-tissue eigenvalue comparison.',
};

const CAT_ORDER = ['clock','target','housekeeping','immune','metabolic','chromatin','signaling','dna_repair','stem','other'];
const ALL_CATS = CAT_ORDER.filter(c => c !== 'other');

const CAT_META: Record<string, { label: string; color: string; bg: string; text: string }> = {
  clock:        { label: 'Clock',      color: '#f59e0b', bg: 'bg-amber-100',   text: 'text-amber-800'   },
  target:       { label: 'Target',     color: '#ef4444', bg: 'bg-red-100',     text: 'text-red-800'     },
  housekeeping: { label: 'HK',         color: '#6b7280', bg: 'bg-gray-100',    text: 'text-gray-700'    },
  immune:       { label: 'Immune',     color: '#8b5cf6', bg: 'bg-violet-100',  text: 'text-violet-800'  },
  metabolic:    { label: 'Metabolic',  color: '#10b981', bg: 'bg-emerald-100', text: 'text-emerald-800' },
  chromatin:    { label: 'Chromatin',  color: '#ec4899', bg: 'bg-pink-100',    text: 'text-pink-800'    },
  signaling:    { label: 'Signaling',  color: '#3b82f6', bg: 'bg-blue-100',    text: 'text-blue-800'    },
  dna_repair:   { label: 'DNA Repair', color: '#14b8a6', bg: 'bg-teal-100',    text: 'text-teal-800'    },
  stem:         { label: 'Stem',       color: '#f97316', bg: 'bg-orange-100',  text: 'text-orange-800'  },
  other:        { label: 'Other',      color: '#475569', bg: 'bg-slate-100',   text: 'text-slate-700'   },
};

function eigenBarColor(v: number): string {
  if (v > 1.0)  return '#7c3aed';
  if (v >= 0.75) return '#ef4444';
  if (v >= 0.55) return '#f59e0b';
  if (v >= 0.35) return '#3b82f6';
  return '#94a3b8';
}

function eigenHeatColor(v: number | null): string {
  if (v === null) return '#f1f5f9';
  if (v > 1.0) return 'rgb(124,58,237)';
  const stops: [number, number, number, number][] = [
    [0.00, 248, 250, 252],
    [0.30, 191, 219, 254],
    [0.50, 253, 230, 138],
    [0.70, 252, 165, 165],
    [1.00, 220,  38,  38],
  ];
  for (let i = 0; i < stops.length - 1; i++) {
    const [a0, r0, g0, b0] = stops[i];
    const [a1, r1, g1, b1] = stops[i + 1];
    if (v >= a0 && v <= a1) {
      const t = (v - a0) / (a1 - a0);
      return `rgb(${Math.round(r0 + t * (r1 - r0))},${Math.round(g0 + t * (g1 - g0))},${Math.round(b0 + t * (b1 - b0))})`;
    }
  }
  return 'rgb(220,38,38)';
}

function PercentileBadge({ p }: { p: number | null }) {
  if (p === null) return null;
  const tier = p >= 90 ? { label: `Top 10%`, cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
             : p >= 75 ? { label: `Top 25%`, cls: 'bg-blue-50 text-blue-700 border-blue-200' }
             : p >= 50 ? { label: `Top 50%`, cls: 'bg-slate-100 text-slate-600 border-slate-200' }
             :            { label: `${p.toFixed(0)}th`, cls: 'bg-slate-50 text-slate-400 border-slate-200' };
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${tier.cls} cursor-help tabular-nums`}>
          {tier.label}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top">
        <p className="text-xs">{p.toFixed(1)}th genome percentile — among all ~20k genes in this tissue</p>
      </TooltipContent>
    </Tooltip>
  );
}

function QBadge({ q }: { q: number | null }) {
  if (q === null) return <span className="text-slate-300 text-xs">—</span>;
  const tier = q < 0.001 ? { label: '< 0.001', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
             : q < 0.01  ? { label: q.toFixed(3), cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
             : q < 0.05  ? { label: q.toFixed(3), cls: 'bg-amber-50 text-amber-700 border-amber-200' }
             :              { label: q.toFixed(3), cls: 'bg-slate-100 text-slate-400 border-slate-200' };
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${tier.cls} cursor-help tabular-nums`}>
          {tier.label}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top">
        <p className="text-xs font-medium">BH-corrected FDR q-value</p>
        <p className="text-xs text-slate-400 mt-0.5">200-permutation null · Benjamini-Hochberg</p>
        <p className="text-xs mt-0.5">{q < 0.05 ? '✓ Significant at 5% FDR' : '✗ Not significant at 5% FDR'}</p>
      </TooltipContent>
    </Tooltip>
  );
}

function EigenBar({ value }: { value: number }) {
  const pct = Math.min(100, Math.round(value * 100));
  const col = eigenBarColor(value);
  return (
    <div className="flex items-center gap-2 min-w-[110px]">
      <div className="w-16 h-2 bg-slate-200 rounded-full overflow-hidden flex-shrink-0">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: col }} />
      </div>
      <span className="text-sm font-mono font-semibold tabular-nums" style={{ color: col }}>
        {value.toFixed(3)}
      </span>
    </div>
  );
}

// ── Gene Drawer ────────────────────────────────────────────────────────────────
function GeneDrawer({ gene, data, catMeans, onClose, onGeneClick }: {
  gene: string; data: AtlasResponse;
  catMeans: Record<string, number>; onClose: () => void; onGeneClick: (g: string) => void;
}) {
  const entries = useMemo(
    () => data.entries.filter(e => e.gene === gene).sort((a, b) => b.eigenvalue - a.eigenvalue),
    [gene, data]
  );
  if (!entries.length) return null;

  const meta = CAT_META[entries[0].category] ?? CAT_META.other;
  const meanLambda = entries.reduce((s, e) => s + e.eigenvalue, 0) / entries.length;
  const maxE = entries[0];
  const complexCount = entries.filter(e => e.isComplex).length;
  const catMean = catMeans[entries[0].category] ?? 0;
  const delta = meanLambda - catMean;

  // Inter-tissue CV (coefficient of variation)
  const lambdas = entries.map(e => e.eigenvalue);
  const sd = lambdas.length > 1 ? Math.sqrt(lambdas.reduce((s, v) => s + (v - meanLambda) ** 2, 0) / lambdas.length) : 0;
  const cv = meanLambda > 0 ? sd / meanLambda : 0;

  // Disease delta summary
  const diseaseEntries = entries.filter(e => e.diseaseDelta !== null);
  const avgDiseaseDelta = diseaseEntries.length
    ? diseaseEntries.reduce((s, e) => s + e.diseaseDelta!, 0) / diseaseEntries.length
    : null;

  const barData = [...entries].reverse().map(e => ({
    tissue: e.tissue,
    lambda: e.eigenvalue,
    isComplex: e.isComplex,
  }));

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/25 backdrop-blur-[2px]" onClick={onClose} />
      <div className="absolute right-0 top-0 h-full w-[440px] bg-white shadow-2xl flex flex-col overflow-hidden">

        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 bg-slate-50 flex-shrink-0">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${meta.bg} ${meta.text}`}>{meta.label}</span>
                {entries.some(e => e.organism === 'Human') && (
                  <span className="text-xs bg-indigo-50 text-indigo-500 px-1.5 py-0.5 rounded font-medium border border-indigo-100">Human</span>
                )}
                {entries.some(e => e.organism === 'Mouse') && (
                  <span className="text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-medium">Mouse</span>
                )}
              </div>
              <h2 className="text-2xl font-bold text-slate-900">{gene}</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {entries.length} tissue{entries.length !== 1 ? 's' : ''} · {complexCount}/{entries.length} complex · CV={cv.toFixed(2)}
              </p>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded hover:bg-slate-100 transition-colors">
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Mini stat row */}
          <div className="grid grid-cols-4 gap-1.5 mt-3">
            {[
              { label: 'Mean |λ|',      val: meanLambda.toFixed(3), color: eigenBarColor(meanLambda) },
              { label: 'Max |λ|',       val: maxE.eigenvalue.toFixed(3), color: eigenBarColor(maxE.eigenvalue) },
              { label: 'vs category',   val: (delta >= 0 ? '+' : '') + delta.toFixed(3), color: delta >= 0.05 ? '#10b981' : delta <= -0.05 ? '#ef4444' : '#94a3b8' },
              { label: 'Cross-tissue CV', val: cv.toFixed(2), color: cv < 0.1 ? '#10b981' : cv < 0.25 ? '#f59e0b' : '#ef4444' },
            ].map(s => (
              <div key={s.label} className="bg-white rounded border border-slate-200 px-2 py-1.5">
                <div className="text-xs font-bold tabular-nums" style={{ color: s.color }}>{s.val}</div>
                <div className="text-[9px] text-slate-400 mt-0.5 leading-tight">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Disease delta banner */}
          {avgDiseaseDelta !== null && (
            <div className={`mt-2 flex items-center gap-2 px-3 py-2 rounded-lg text-xs ${
              avgDiseaseDelta < -0.02 ? 'bg-red-50 border border-red-200 text-red-700' :
              avgDiseaseDelta > 0.02 ? 'bg-emerald-50 border border-emerald-200 text-emerald-700' :
              'bg-slate-50 border border-slate-200 text-slate-600'
            }`}>
              {avgDiseaseDelta < -0.02 ? <TrendingDown className="h-3.5 w-3.5 flex-shrink-0" /> : <TrendingUp className="h-3.5 w-3.5 flex-shrink-0" />}
              <span>
                <strong>ApcKO organoid:</strong> {avgDiseaseDelta >= 0 ? '+' : ''}{avgDiseaseDelta.toFixed(3)} Δ|λ| vs WT
                {avgDiseaseDelta < -0.02 ? ' — loses circadian memory in APC-loss cancer' : avgDiseaseDelta > 0.02 ? ' — gains oscillation in ApcKO' : ' — stable across APC status'}
              </span>
            </div>
          )}
        </div>

        {/* Gene profile card */}
        {(() => {
          const profile = GENE_PROFILES[gene.toUpperCase()] ?? GENE_PROFILES[gene];
          const desc = profile?.desc ?? CAT_DESC[entries[0].category] ?? '';
          const role = profile?.role ?? entries[0].categoryLabel;
          const citation = profile?.citation ?? '';
          const canonicalPeak = profile?.canonicalPeak ?? null;
          const unstableEntries = entries.filter(e => e.eigenvalue > 1.0);
          const hasUnstable = unstableEntries.length > 0;
          const unstableTissues = [...new Set(unstableEntries.map(e => e.tissue))];
          return (
            <div className="mx-4 mt-3 mb-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 flex-shrink-0">
              <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Gene Profile</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200 text-slate-600 font-medium">{role}</span>
                {canonicalPeak && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 font-mono">
                    Peak {canonicalPeak}
                  </span>
                )}
                {hasUnstable && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-50 text-violet-700 border border-violet-200 font-medium">
                    ⚠ Non-stationary in {unstableTissues.join(', ')}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-600 leading-relaxed">{desc}</p>
              {hasUnstable && (
                <p className="text-[11px] text-violet-600 mt-1 leading-relaxed">
                  <strong>|λ| &gt; 1 interpretation:</strong> Real roots outside the unit circle indicate a sustained monotonic trend (increasing or decreasing without oscillation). In GSE113883 (Braun et al. 2018, PNAS — TimeSignature circadian profiling study; 11 healthy adults, 2h sampling over 28h constant routine), these genes trend monotonically rather than oscillate. This is not a sleep deprivation study; the driver of these trends is not established from this dataset.
                </p>
              )}
              {citation && (
                <p className="text-[10px] text-slate-400 mt-1.5 italic">{citation}</p>
              )}
            </div>
          );
        })()}

        {/* Per-gene dataset caveat banner — shown when the gene has a tissue-specific inhibitor-bias note */}
        {(() => {
          const affectedEntries = entries.filter(e => getGeneTissueCaveat(gene, e.tissue) !== null);
          if (affectedEntries.length === 0) return null;
          const caveatInfo = getGeneTissueCaveat(gene, affectedEntries[0].tissue)!;
          return (
            <div className="mx-4 mb-1 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 flex-shrink-0 flex items-start gap-2">
              <span className="text-amber-500 text-sm flex-shrink-0 mt-px">⚠</span>
              <div>
                <p className="text-[11px] font-semibold text-amber-800">{caveatInfo.label}</p>
                <p className="text-[11px] text-amber-700 leading-relaxed mt-0.5">{caveatInfo.caveat}</p>
              </div>
            </div>
          );
        })()}

        {/* Bar chart */}
        <div className="px-4 pt-3 pb-2 flex-shrink-0">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">|λ| by tissue</div>
          {(() => {
            const maxLambda = Math.max(...barData.map(d => d.lambda), 1.0);
            const xMax = maxLambda > 1.0 ? Math.ceil(maxLambda * 10) / 10 + 0.05 : 1.0;
            return (
              <ResponsiveContainer width="100%" height={Math.max(160, barData.length * 22)}>
                <BarChart data={barData} layout="vertical" margin={{ left: 88, right: 36, top: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                  <XAxis type="number" domain={[0, xMax]} tick={{ fontSize: 10, fill: '#94a3b8' }} tickCount={6} />
                  <YAxis type="category" dataKey="tissue" tick={{ fontSize: 10, fill: '#64748b' }} width={86} />
                  {xMax > 1.0 && <ReferenceLine x={1.0} stroke="#7c3aed" strokeDasharray="3 3" strokeWidth={1.5}
                    label={{ value: '|λ|=1', position: 'insideTopRight', fontSize: 9, fill: '#7c3aed' }} />}
                  <ReferenceLine x={catMean} stroke={meta.color} strokeDasharray="4 2" strokeWidth={1.5}
                    label={{ value: 'cat.', position: 'insideTopRight', fontSize: 9, fill: meta.color }} />
                  <RechartsTip formatter={(v: number) => [v.toFixed(3), '|λ|']} contentStyle={{ fontSize: 12, borderRadius: 6 }} />
                  <Bar dataKey="lambda" radius={[0, 3, 3, 0]}>
                    {barData.map((d, i) => <Cell key={i} fill={d.lambda > 1.0 ? '#7c3aed' : d.isComplex ? '#f59e0b' : '#94a3b8'} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            );
          })()}
          <div className="flex gap-4 mt-1 text-[10px] text-slate-400">
            <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-sm bg-amber-400" />Complex (oscillatory)</span>
            <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-sm bg-slate-300" />Real (monotone)</span>
            <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-sm" style={{ backgroundColor: '#7c3aed' }} />Non-stationary</span>
          </div>
        </div>

        {/* Similar genes */}
        {(() => {
          const allGeneNames = [...new Set(data.entries.map(e => e.gene))].filter(g => g !== gene);
          const myTissues = new Map(entries.map(e => [e.tissue, e.eigenvalue]));
          const similar = allGeneNames.map(g => {
            const gEntries = data.entries.filter(e => e.gene === g);
            const sharedTissues = gEntries.filter(e => myTissues.has(e.tissue));
            if (sharedTissues.length < 2) return null;
            const a = sharedTissues.map(e => myTissues.get(e.tissue)!);
            const b = sharedTissues.map(e => e.eigenvalue);
            const dot = a.reduce((s, ai, i) => s + ai * b[i], 0);
            const magA = Math.sqrt(a.reduce((s, ai) => s + ai * ai, 0));
            const magB = Math.sqrt(b.reduce((s, bi) => s + bi * bi, 0));
            const sim = magA > 0 && magB > 0 ? dot / (magA * magB) : 0;
            const gMeta = CAT_META[gEntries[0].category] ?? CAT_META.other;
            return { gene: g, sim, category: gEntries[0].category, meta: gMeta, mean: b.reduce((s, v) => s + v, 0) / b.length };
          }).filter(Boolean).sort((a, b) => b!.sim - a!.sim).slice(0, 5) as { gene: string; sim: number; category: string; meta: typeof CAT_META[string]; mean: number }[];
          if (!similar.length) return null;
          return (
            <div className="border-t border-slate-200 px-4 py-3 flex-shrink-0 bg-slate-50/50">
              <div className="flex items-center gap-1.5 mb-2">
                <GitCompare className="h-3 w-3 text-slate-400" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Similar tissue profile</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {similar.map(s => (
                  <button key={s.gene} onClick={() => onGeneClick(s.gene)}
                    className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold border ${s.meta.bg} ${s.meta.text} border-transparent hover:opacity-80 transition-opacity`}
                    title={`Cosine similarity: ${(s.sim * 100).toFixed(0)}% · Mean |λ| ${s.mean.toFixed(2)}`}>
                    <span>{s.gene}</span>
                    <span className="opacity-60 text-[9px] font-mono">{(s.sim * 100).toFixed(0)}%</span>
                  </button>
                ))}
              </div>
              <p className="text-[9px] text-slate-400 mt-1.5">Ranked by cosine similarity of tissue eigenvalue vectors. Hover for detail.</p>
            </div>
          );
        })()}

        {/* Per-tissue table */}
        <div className="flex-1 overflow-y-auto border-t border-slate-200">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-3 py-2 font-semibold text-slate-500">Tissue</th>
                <th className="text-right px-2 py-2 font-semibold text-slate-500">|λ|</th>
                <th className="text-right px-2 py-2 font-semibold text-slate-500">R²</th>
                <th className="text-right px-2 py-2 font-semibold text-slate-500">%ile</th>
                <th className="text-center px-2 py-2 font-semibold text-slate-500">Roots</th>
                <th className="text-right px-2 py-2 font-semibold text-slate-500">Peak CT</th>
                <th className="text-right px-2 py-2 font-semibold text-slate-500">
                  {data?.datasetCaveats?.GSE157357 ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="cursor-help inline-flex items-center gap-1 text-amber-700">
                          ΔApcKO <span className="text-amber-500 text-[10px]">⚠</span>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs">
                        <p className="text-xs font-semibold text-amber-700 mb-1">Temporal coverage caveat — GSE157357</p>
                        <p className="text-xs leading-relaxed">{data.datasetCaveats!.GSE157357}</p>
                      </TooltipContent>
                    </Tooltip>
                  ) : 'ΔApcKO'}
                </th>
              </tr>
            </thead>
            <tbody>
              {entries.map(e => {
                const rowCaveat = getGeneTissueCaveat(gene, e.tissue);
                return (
                <tr key={e.tissue} className={`border-b border-slate-100 hover:bg-slate-50 ${rowCaveat ? 'bg-amber-50/40' : ''}`}>
                  <td className="px-3 py-2 text-slate-700">
                    <span>{e.tissue}</span>
                    {e.organism === 'Human' && <span className="ml-1 text-[9px] text-indigo-400">H</span>}
                    {rowCaveat && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="ml-1.5 cursor-help text-amber-500 text-[11px] align-middle">⚠</span>
                        </TooltipTrigger>
                        <TooltipContent side="right" className="max-w-xs">
                          <p className="text-xs font-semibold text-amber-700 mb-1">{rowCaveat.label}</p>
                          <p className="text-xs leading-relaxed">{rowCaveat.caveat}</p>
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </td>
                  <td className="px-2 py-2 text-right font-mono font-semibold tabular-nums" style={{ color: eigenBarColor(e.eigenvalue) }}>
                    {e.eigenvalue.toFixed(3)}
                  </td>
                  <td className="px-2 py-2 text-right font-mono tabular-nums text-slate-500 text-[11px]">
                    {e.r2.toFixed(2)}
                  </td>
                  <td className="px-2 py-2 text-right">
                    {e.genomePercentile !== null
                      ? <span className="text-[10px] text-slate-500 tabular-nums">{e.genomePercentile.toFixed(0)}th</span>
                      : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-2 py-2 text-center">
                    <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${e.isComplex ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>
                      {e.isComplex ? '⊙' : '→'}
                    </span>
                  </td>
                  <td className="px-2 py-2 text-right text-slate-500 tabular-nums">
                    {e.phase !== null ? `CT${e.phase.toFixed(0)}` : '—'}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">
                    {e.diseaseDelta !== null ? (
                      <span style={{ color: e.diseaseDelta < -0.02 ? '#ef4444' : e.diseaseDelta > 0.02 ? '#10b981' : '#94a3b8' }}>
                        {e.diseaseDelta >= 0 ? '+' : ''}{e.diseaseDelta.toFixed(3)}
                      </span>
                    ) : <span className="text-slate-300">—</span>}
                  </td>
                </tr>
              );
              })}
            </tbody>
          </table>
        </div>

        {/* Explanation */}
        <div className="px-4 py-3 border-t border-slate-200 bg-slate-50 flex-shrink-0">
          <p className="text-[11px] text-slate-500 leading-relaxed">{entries[0].explanation}</p>
        </div>
      </div>
    </div>
  );
}

// ── Heatmap View ───────────────────────────────────────────────────────────────
type GeneRow = { gene: string; category: string; categoryLabel: string; categoryColor: string; tissueMap: Map<string, AtlasEntry>; mean: number };

function phaseHeatColor(phase: number | null): string {
  if (phase === null) return '#f1f5f9';
  return `hsl(${Math.round((phase / 24) * 360)}, 65%, 52%)`;
}

function HeatmapView({ genes, tissues, onGeneClick, selectedCats, selectedOrganism, selectedTissue }: {
  genes: GeneRow[]; tissues: string[]; onGeneClick: (g: string) => void;
  selectedCats: Set<string>; selectedOrganism: string; selectedTissue: string;
}) {
  const [mode, setMode] = useState<'eigenvalue' | 'phase'>('eigenvalue');

  const filteredGenes = useMemo(() => {
    let gs = selectedCats.size > 0 ? genes.filter(g => selectedCats.has(g.category)) : genes;
    if (selectedOrganism !== 'all') {
      gs = gs.filter(g => {
        const entries = [...g.tissueMap.values()];
        return entries.some(e => e.organism === selectedOrganism);
      });
    }
    return gs;
  }, [genes, selectedCats, selectedOrganism]);

  const visibleTissues = useMemo(() => {
    if (selectedTissue !== 'all') {
      // When a specific tissue is chosen, only show it if it has data for the
      // selected organism — otherwise the column would be entirely grey.
      if (selectedOrganism !== 'all') {
        const hasOrgData = filteredGenes.some(
          g => g.tissueMap.has(selectedTissue) && g.tissueMap.get(selectedTissue)?.organism === selectedOrganism
        );
        return hasOrgData ? [selectedTissue] : [];
      }
      return [selectedTissue];
    }
    if (selectedOrganism === 'Human') return tissues.filter(t => filteredGenes.some(g => g.tissueMap.has(t) && g.tissueMap.get(t)?.organism === 'Human'));
    if (selectedOrganism === 'Mouse') return tissues.filter(t => filteredGenes.some(g => g.tissueMap.has(t) && g.tissueMap.get(t)?.organism === 'Mouse'));
    return tissues;
  }, [tissues, filteredGenes, selectedOrganism, selectedTissue]);

  // Identify which tissues are human (for separator)
  const humanTissueSet = useMemo(() => {
    const s = new Set<string>();
    for (const g of genes) {
      for (const [t, e] of g.tissueMap) {
        if (e.organism === 'Human') s.add(t);
      }
    }
    return s;
  }, [genes]);

  const firstHumanIdx = useMemo(() => {
    if (selectedOrganism !== 'all') return -1;
    const idx = visibleTissues.findIndex(t => humanTissueSet.has(t));
    return idx;
  }, [visibleTissues, humanTissueSet, selectedOrganism]);

  // Per-row means restricted to currently visible tissues + selected organism,
  // so the "Mean" column reflects what the user is actually looking at.
  const visibleMeans = useMemo(() => {
    const m = new Map<string, number>();
    for (const row of filteredGenes) {
      const vals = visibleTissues
        .map(t => row.tissueMap.get(t))
        .filter((e): e is NonNullable<typeof e> =>
          e !== undefined && (selectedOrganism === 'all' || e.organism === selectedOrganism)
        )
        .map(e => e.eigenvalue);
      m.set(row.gene, vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : NaN);
    }
    return m;
  }, [filteredGenes, visibleTissues, selectedOrganism]);

  if (filteredGenes.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-slate-400 text-sm">
        No genes match the current filters.
      </div>
    );
  }

  if (visibleTissues.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-slate-400 text-sm">
        No {selectedOrganism !== 'all' ? selectedOrganism : ''} data in{' '}
        <span className="font-medium text-slate-600">{selectedTissue}</span>.
        Try switching organism to "All organisms" or choosing a different tissue.
      </div>
    );
  }

  let lastCat = '';

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
      <div className="px-4 py-2.5 border-b border-slate-200 flex items-center gap-4 flex-wrap">

        {/* Mode toggle */}
        <div className="flex rounded-md border border-slate-200 overflow-hidden">
          <button onClick={() => setMode('eigenvalue')}
            className={`px-2.5 py-1 text-[11px] font-semibold transition-colors ${mode === 'eigenvalue' ? 'bg-slate-800 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`}>
            |λ| Persistence
          </button>
          <button onClick={() => setMode('phase')}
            className={`px-2.5 py-1 text-[11px] font-semibold border-l border-slate-200 transition-colors ${mode === 'phase' ? 'bg-slate-800 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`}>
            Peak CT Phase
          </button>
        </div>

        {mode === 'eigenvalue' ? (
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-400">0.0</span>
            <div className="w-28 h-3 rounded-full border border-slate-200"
              style={{ background: 'linear-gradient(to right, #f8fafc, #bfdbfe 30%, #fde68a 50%, #fca5a5 70%, #dc2626)' }} />
            <span className="text-xs text-slate-400">1.0</span>
            <div className="flex items-center gap-1 ml-1">
              <div className="w-4 h-3 rounded-sm" style={{ backgroundColor: 'rgb(124,58,237)' }} />
              <span className="text-xs text-violet-700 font-mono font-bold">&gt;1</span>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-400">CT0</span>
            <div className="w-28 h-3 rounded-full border border-slate-200"
              style={{ background: 'linear-gradient(to right, hsl(0,65%,52%), hsl(90,65%,52%), hsl(180,65%,52%), hsl(270,65%,52%), hsl(360,65%,52%))' }} />
            <span className="text-xs text-slate-400">CT24</span>
            <span className="text-xs text-slate-300 ml-1">(grey = no oscillation)</span>
          </div>
        )}

        <span className="text-xs text-slate-400">Click row → detail</span>
        {firstHumanIdx > 0 && (
          <span className="text-xs text-slate-400 hidden sm:inline">
            <span className="inline-block w-2 h-2 rounded-sm bg-slate-300 mr-1" />Mouse
            <span className="mx-1.5">·</span>
            <span className="inline-block w-2 h-2 rounded-sm bg-indigo-300 mr-1" />Human
          </span>
        )}
        <span className="text-xs text-slate-400 ml-auto">{filteredGenes.length} genes × {visibleTissues.length} tissues</span>
      </div>

      <div className="overflow-auto" style={{ maxHeight: 'calc(100vh - 320px)' }}>
        <table className="text-xs border-collapse" style={{ width: '100%', minWidth: 420 }}>
          <thead className="sticky top-0 bg-white z-10">
            <tr>
              <th className="w-28 px-2 py-1 text-left border-b border-slate-200" />
              {visibleTissues.map((t, ti) => {
                const isFirstHuman = ti === firstHumanIdx;
                return (
                  <th key={t} className={`text-center border-b border-slate-200 ${isFirstHuman ? 'border-l-2 border-l-indigo-300' : ''}`} style={{ minWidth: 26 }}>
                    <span className="text-[10px] font-medium inline-block"
                      style={{
                        writingMode: 'vertical-rl', transform: 'rotate(180deg)', padding: '4px 2px',
                        color: humanTissueSet.has(t) ? '#6366f1' : '#64748b',
                      }}>
                      {t.length > 9 ? t.slice(0, 8) + '…' : t}
                    </span>
                  </th>
                );
              })}
              <th className="border-b border-slate-200 px-2 text-center" style={{ minWidth: 44 }}>
                <span className="text-[10px] text-slate-500">Mean</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredGenes.map(row => {
              const isNewCat = row.category !== lastCat;
              lastCat = row.category;
              const meta = CAT_META[row.category] ?? CAT_META.other;

              return (
                <React.Fragment key={row.gene}>
                {isNewCat && (
                  <tr>
                    <td colSpan={visibleTissues.length + 2}
                      className="px-3 py-1 text-[10px] font-bold uppercase tracking-widest border-t border-b"
                      style={{ backgroundColor: meta.color + '18', color: meta.color, borderColor: meta.color + '30' }}>
                      {meta.label}
                    </td>
                  </tr>
                )}
                <tr className="hover:brightness-95 cursor-pointer transition-all"
                  onClick={() => onGeneClick(row.gene)} data-testid={`heatmap-row-${row.gene}`}>
                  <td className="px-2 py-px sticky left-0 bg-white z-[1] border-b border-slate-100">
                    <div className="flex items-center gap-1.5">
                      <div className="w-1 h-4 rounded flex-shrink-0" style={{ backgroundColor: meta.color }} />
                      <span className="text-slate-700 text-[11px] font-medium truncate" style={{ maxWidth: 84 }}>{row.gene}</span>
                    </div>
                  </td>
                  {visibleTissues.map((t, ti) => {
                    const rawEntry = row.tissueMap.get(t);
                    // Mask entries from the wrong organism so cross-species data
                    // never bleeds into a filtered single-organism view.
                    const e = (selectedOrganism !== 'all' && rawEntry?.organism !== selectedOrganism)
                      ? undefined : rawEntry;
                    const isFirstHuman = ti === firstHumanIdx;
                    const bg = mode === 'eigenvalue'
                      ? eigenHeatColor(e?.eigenvalue ?? null)
                      : (e?.isComplex && e?.phase !== null ? phaseHeatColor(e.phase) : '#e2e8f0');
                    const unstable = mode === 'eigenvalue' && (e?.eigenvalue ?? 0) > 1.0;
                    const bright = mode === 'eigenvalue' && (e?.eigenvalue ?? 0) > 0.62;
                    return (
                      <Tooltip key={t}>
                        <TooltipTrigger asChild>
                          <td style={{ backgroundColor: bg, height: 16, padding: 0 }}
                            className={`border-r border-b border-white/40 ${isFirstHuman ? 'border-l-2 border-l-indigo-200' : ''}`}>
                            {unstable ? (
                              <div className="flex items-center justify-center h-full">
                                <span className="text-[8px] text-white font-mono font-bold leading-none">&gt;1</span>
                              </div>
                            ) : mode === 'eigenvalue' && bright ? (
                              <div className="flex items-center justify-center h-full">
                                <span className="text-[8px] text-white/90 font-mono tabular-nums leading-none">
                                  {e?.eigenvalue.toFixed(2)}
                                </span>
                              </div>
                            ) : mode === 'phase' && e?.phase !== null && e?.isComplex ? (
                              <div className="flex items-center justify-center h-full">
                                <span className="text-[8px] text-white/90 font-mono tabular-nums leading-none">
                                  {e.phase.toFixed(0)}
                                </span>
                              </div>
                            ) : null}
                          </td>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-xs">
                          {e ? (
                            <><strong>{row.gene}</strong> — {t}<br />
                              |λ| = {e.eigenvalue.toFixed(3)} · {e.isComplex ? '⊙ Complex' : '→ Real'}
                              {e.eigenvalue > 1.0 ? ' · ⚠ Non-stationary' : ''}
                              {e.phase !== null ? ` · Peak CT${e.phase.toFixed(0)}` : ''}
                              {e.genomePercentile !== null ? ` · ${e.genomePercentile.toFixed(0)}th %ile` : ''}
                            </>
                          ) : <><strong>{row.gene}</strong> — not in {t}</>}
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                  <td className="px-2 py-px text-center font-mono text-[10px] tabular-nums text-slate-600 border-b border-slate-100">
                    {(() => { const m = visibleMeans.get(row.gene); return (m !== undefined && !isNaN(m)) ? m.toFixed(2) : '—'; })()}
                  </td>
                </tr>
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Historical Context ─────────────────────────────────────────────────────────
function HistoricalContext() {
  const [open, setOpen] = useState(false);
  return (
    <div className="mb-5 bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
      <button className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors"
        onClick={() => setOpen(o => !o)} data-testid="button-historical-context">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-slate-400 flex-shrink-0" />
          <span className="text-sm font-semibold text-slate-800">Before this atlas — how did researchers do this?</span>
          <span className="text-xs text-slate-400 hidden sm:inline ml-1">What existed before, and what was missing</span>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
      </button>
      {open && (
        <div className="border-t border-slate-100 px-5 py-5 grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-5 text-xs text-slate-600 leading-relaxed bg-slate-50/30">

          <div>
            <h3 className="font-bold text-slate-800 mb-1.5 flex items-center gap-1.5">
              <span className="w-1.5 h-4 rounded bg-slate-400 inline-block" />
              JTK_CYCLE and RAIN (the standard tests)
            </h3>
            <p>
              The field's workhorse since 2010. You download your own dataset, run the algorithm, and get a p-value for whether each gene oscillates at approximately 24 hours. It requires clean, evenly-spaced timepoints, assumes a sinusoidal waveform, and gives you a yes/no answer per gene per experiment. To compare across tissues, you had to run it independently on a dozen different datasets, then manually collate the results into a spreadsheet. No cross-tissue summary existed. No cancer comparison was built in. No genome-wide context told you whether your p=0.02 was genuinely unusual or typical background noise.
            </p>
          </div>

          <div>
            <h3 className="font-bold text-slate-800 mb-1.5 flex items-center gap-1.5">
              <span className="w-1.5 h-4 rounded bg-slate-400 inline-block" />
              Cosinor analysis
            </h3>
            <p>
              The oldest method — fits a single cosine curve to the time series and reports amplitude, phase, and whether the fit is statistically significant. Amplitude-based: a gene with noisy but sustained expression scores poorly; a gene with a clean but shallow oscillation scores well. Cosinor and AR(2) are largely independent (Spearman ρ ≈ 0.22), which means each captures real biology the other misses. Cosinor is useful for confirming sinusoidal rhythmicity. It tells you almost nothing about whether a gene's temporal state persists — which is the question that matters for sustained pathway coupling.
            </p>
          </div>

          <div>
            <h3 className="font-bold text-slate-800 mb-1.5 flex items-center gap-1.5">
              <span className="w-1.5 h-4 rounded bg-slate-400 inline-block" />
              CircaDB and static databases
            </h3>
            <p>
              CircaDB (Pizarro et al. 2013) catalogued cycling genes from published microarray studies. It was a major step forward — you could look up a gene and see whether it had previously been identified as rhythmic. But it was mouse-only, based on a fixed set of older studies, covered a limited tissue range, and reported amplitude-based binary calls (cycling/not cycling). Querying it for Wee1 would tell you it was identified as cycling in liver. It would not tell you its eigenvalue in kidney, whether it's in the 95th percentile of the genome-wide persistence distribution, or whether it loses that persistence in APC-loss cancer.
            </p>
          </div>

          <div>
            <h3 className="font-bold text-slate-800 mb-1.5 flex items-center gap-1.5">
              <span className="w-1.5 h-4 rounded bg-slate-400 inline-block" />
              Manual literature review, gene by gene
            </h3>
            <p>
              For any gene not in the databases, the only option was PubMed — searching for the gene name plus "circadian" and reading papers one at a time. A researcher characterising Wee1's circadian biology in 2019 would have found the Matsuo 2003 Science paper, perhaps two or three follow-up studies, and no systematic comparison to other tissues. Assembling a 12-tissue, 430-gene comparison across mouse and human data, with cancer delta and genome percentile context, would have taken months of manual work and remained unpublishable as a standalone result.
            </p>
          </div>

          <div>
            <h3 className="font-bold text-slate-800 mb-1.5 flex items-center gap-1.5">
              <span className="w-1.5 h-4 rounded bg-slate-400 inline-block" />
              What was missing from all of them
            </h3>
            <p>
              Every prior tool asked the same question: <em>does this gene oscillate at ~24 hours?</em> None asked: <em>how much does this gene's expression at one timepoint predict the next, regardless of shape?</em> That second question is different — it captures sustained state persistence rather than rhythmic amplitude, and it is largely orthogonal to oscillation. About 47% of expressed genes that carry temporal memory are invisible to JTK_CYCLE and cosinor because they are not sinusoidal. No existing tool provided: genome-wide context, cross-tissue comparison, cancer delta, and significance correction in a single queryable interface.
            </p>
          </div>

          <div>
            <h3 className="font-bold text-slate-800 mb-1.5 flex items-center gap-1.5">
              <span className="w-1.5 h-4 rounded bg-slate-400 inline-block" />
              What the atlas adds
            </h3>
            <p>
              One interface, one computation, one metric. For every gene in the panel, across every tissue tested, in both mouse and human, you get: the temporal persistence score (|λ|), where it ranks against the full genome in that tissue (percentile), whether the signal is statistically unusual rather than background noise (FDR q-value), what its phase is if it oscillates, how it changes in cancer (ΔApcKO), and whether the signal replicates across independent datasets. A cross-tissue comparison that would previously have taken weeks of bespoke scripting is a filter and a sort.
            </p>
          </div>

        </div>
      )}
    </div>
  );
}


// ── Main Page ──────────────────────────────────────────────────────────────────
const PAGE_SIZE = 60;

export default function GeneEigenvalueAtlas() {
  const [view, setView] = useState<'table' | 'heatmap'>('table');
  const [search, setSearch] = useState('');
  const [selectedCats, setSelectedCats] = useState<Set<string>>(new Set());
  const [selectedTissue, setSelectedTissue] = useState('all');
  const [selectedOrganism, setSelectedOrganism] = useState('all');
  const [sortBy, setSortBy] = useState<'eigenvalue_desc'|'eigenvalue_asc'|'gene'|'category'|'phase'|'percentile'|'qvalue'|'cv_asc'>('qvalue');
  const [page, setPage] = useState(1);
  const [selectedGene, setSelectedGene] = useState<string | null>(null);

  // Pre-populate search from URL param ?q=GENENAME (linked from landing page search)
  const searchParams = useSearch();
  useEffect(() => {
    const q = new URLSearchParams(searchParams).get('q');
    if (q) { setSearch(q); setPage(1); }
  }, []);

  const { data, isLoading, error } = useQuery<AtlasResponse>({
    queryKey: ['gene-eigenvalue-atlas'],
    queryFn: async () => {
      const r = await fetch('/api/gene-eigenvalue-atlas');
      if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error || `HTTP ${r.status}`); }
      return r.json();
    },
    staleTime: 60 * 60 * 1000,
  });

  const allTissues = useMemo(() => {
    if (!data) return [];
    // Sort organism-first (Mouse before Human) then alphabetically within each group,
    // so the human/mouse separator in the heatmap fires in the correct place.
    const tissueOrg = new Map<string, string>();
    for (const e of data.entries) if (!tissueOrg.has(e.tissue)) tissueOrg.set(e.tissue, e.organism);
    return [...new Set(data.entries.map(e => e.tissue))].sort((a, b) => {
      const oa = tissueOrg.get(a) ?? 'Mouse', ob = tissueOrg.get(b) ?? 'Mouse';
      if (oa !== ob) return oa === 'Mouse' ? -1 : 1;
      return a.localeCompare(b);
    });
  }, [data]);

  const catMeans = useMemo(() => {
    if (!data) return {};
    const result: Record<string, number> = {};
    for (const cat of CAT_ORDER) {
      const vals = data.entries.filter(e => e.category === cat).map(e => e.eigenvalue);
      if (vals.length) result[cat] = vals.reduce((a, b) => a + b, 0) / vals.length;
    }
    return result;
  }, [data]);

  const geneRows = useMemo((): GeneRow[] => {
    if (!data) return [];
    const map = new Map<string, GeneRow>();
    for (const e of data.entries) {
      if (!map.has(e.gene)) {
        map.set(e.gene, { gene: e.gene, category: e.category, categoryLabel: e.categoryLabel, categoryColor: e.categoryColor, tissueMap: new Map(), mean: 0 });
      }
      map.get(e.gene)!.tissueMap.set(e.tissue, e);
    }
    const rows = [...map.values()];
    for (const r of rows) {
      const vals = [...r.tissueMap.values()].map(e => e.eigenvalue);
      r.mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    }
    rows.sort((a, b) => {
      const ca = CAT_ORDER.indexOf(a.category), cb = CAT_ORDER.indexOf(b.category);
      if (ca !== cb) return ca - cb;
      return b.mean - a.mean;
    });
    return rows;
  }, [data]);

  const filtered = useMemo(() => {
    if (!data) return [];
    let es = data.entries;
    if (search.trim()) { const q = search.trim().toUpperCase(); es = es.filter(e => e.gene.toUpperCase().includes(q)); }
    if (selectedCats.size > 0) es = es.filter(e => selectedCats.has(e.category));
    if (selectedTissue !== 'all') es = es.filter(e => e.tissue === selectedTissue);
    if (selectedOrganism !== 'all') es = es.filter(e => e.organism === selectedOrganism);
    const s = [...es];
    if (sortBy === 'eigenvalue_desc') s.sort((a, b) => b.eigenvalue - a.eigenvalue);
    else if (sortBy === 'eigenvalue_asc') s.sort((a, b) => a.eigenvalue - b.eigenvalue);
    else if (sortBy === 'gene') s.sort((a, b) => a.gene.localeCompare(b.gene));
    else if (sortBy === 'category') s.sort((a, b) => CAT_ORDER.indexOf(a.category) - CAT_ORDER.indexOf(b.category));
    else if (sortBy === 'phase') s.sort((a, b) => (a.phase ?? 999) - (b.phase ?? 999));
    else if (sortBy === 'percentile') s.sort((a, b) => (b.genomePercentile ?? 0) - (a.genomePercentile ?? 0));
    else if (sortBy === 'qvalue') s.sort((a, b) => (a.qValue ?? 1) - (b.qValue ?? 1));
    else if (sortBy === 'cv_asc') {
      const geneVals = new Map<string, number[]>();
      for (const e of s) { if (!geneVals.has(e.gene)) geneVals.set(e.gene, []); geneVals.get(e.gene)!.push(e.eigenvalue); }
      const geneCV = new Map<string, number>();
      for (const [g, vals] of geneVals) {
        const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
        const sd = Math.sqrt(vals.reduce((a, v) => a + (v - mean) ** 2, 0) / vals.length);
        geneCV.set(g, mean > 0 ? sd / mean : 0);
      }
      s.sort((a, b) => (geneCV.get(a.gene) ?? 0) - (geneCV.get(b.gene) ?? 0));
    }
    return s;
  }, [data, search, selectedCats, selectedTissue, selectedOrganism, sortBy]);

  const paginated = useMemo(() => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [filtered, page]);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  const catCounts = useMemo(() => {
    const m: Record<string, number> = {};
    if (data) for (const e of data.entries) m[e.category] = (m[e.category] || 0) + 1;
    return m;
  }, [data]);

  const stats = useMemo(() => {
    if (!data?.entries.length) return null;
    const human = data.entries.filter(e => e.organism === 'Human');
    const humanTissues = new Set(human.map(e => e.tissue)).size;
    return {
      uniqueGenes: new Set(data.entries.map(e => e.gene)).size,
      complexPct: (data.entries.filter(e => e.isComplex).length / data.entries.length * 100).toFixed(0),
      meanLambda: (data.entries.reduce((s, e) => s + e.eigenvalue, 0) / data.entries.length).toFixed(3),
      humanEntries: human.length,
      humanTissues,
    };
  }, [data]);

  function toggleCat(cat: string) { setSelectedCats(prev => { const n = new Set(prev); n.has(cat) ? n.delete(cat) : n.add(cat); return n; }); setPage(1); }
  function resetFilters() { setSearch(''); setSelectedCats(new Set()); setSelectedTissue('all'); setSelectedOrganism('all'); setPage(1); }

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-slate-50">

        {/* Header */}
        <div className="bg-white border-b border-slate-200 px-6 py-4">
          <div className="max-w-screen-xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/"><Button variant="ghost" size="sm" className="gap-1 text-slate-600"><ArrowLeft className="h-4 w-4" />Back</Button></Link>
              <div className="w-px h-6 bg-slate-200" />
              <LayoutGrid className="h-5 w-5 text-violet-500 flex-shrink-0" />
              <div>
                <h1 className="text-xl font-bold text-slate-900">Gene Eigenvalue Atlas</h1>
                <p className="text-xs text-slate-500 mt-0.5">AR(2) |λ| · phase · genome percentile · disease Δλ · for every panel gene × tissue</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => window.open('/api/gene-eigenvalue-atlas/download', '_blank')} data-testid="button-download-csv">
                <Download className="h-3.5 w-3.5" />CSV
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5"
                onClick={() => { if (!data) return; const b = new Blob([JSON.stringify(filtered, null, 2)], { type: 'application/json' }); const u = URL.createObjectURL(b); const a = document.createElement('a'); a.href = u; a.download = 'gene_eigenvalue_atlas.json'; a.click(); URL.revokeObjectURL(u); }}
                data-testid="button-download-json">
                <Download className="h-3.5 w-3.5" />JSON
              </Button>
            </div>
          </div>
        </div>

        <div className="max-w-screen-xl mx-auto px-6 py-6">

          {/* Stats */}
          {stats && data && (
            <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 mb-5">
              {[
                { label: 'Total entries',    val: data.total.toLocaleString(),      color: 'text-slate-900' },
                { label: 'Unique genes',     val: String(stats.uniqueGenes),        color: 'text-slate-900' },
                { label: 'Mouse tissues',    val: String(allTissues.filter(t => data.entries.find(e => e.tissue === t && e.organism === 'Mouse')).length), color: 'text-slate-900' },
                { label: 'Human tissues',    val: String(stats.humanTissues),       color: 'text-indigo-600' },
                { label: 'Complex roots',    val: `${stats.complexPct}%`,           color: 'text-amber-600' },
                { label: 'Mean |λ|',         val: stats.meanLambda,                 color: 'text-slate-900' },
              ].map(s => (
                <div key={s.label} className="bg-white rounded-lg border border-slate-200 px-4 py-3">
                  <div className={`text-2xl font-bold tabular-nums ${s.color}`}>{s.val}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{s.label}</div>
                </div>
              ))}
            </div>
          )}

          {/* Quick reference: what |λ| means — shown above the fold so new users don't have to scroll */}
          <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 mb-5 flex gap-3">
            <Info className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
            <div className="text-sm text-slate-700 space-y-1">
              <p>
                <span className="font-semibold">Reading the atlas:</span> Each entry shows |λ|, the <em>persistence score</em> — how strongly a gene's current expression level predicts its next measurement (0 = no memory, 1 = fully self-sustaining).{" "}
                <span className="font-semibold">Persistence is not rhythmicity:</span> a gene can score high without oscillating (e.g. a constitutively active regulator), and can oscillate with a low score if its rhythm is externally driven rather than self-maintained.
              </p>
              <p className="text-xs text-slate-500">
                <span className="font-medium text-slate-600">Complex roots</span> → the AR(2) fit has an implied oscillation period (shown in the Phase column).{" "}
                <span className="font-medium text-slate-600">Real roots</span> → monotone decay or growth, no implied period.{" "}
                <span className="font-medium text-slate-600">|λ| ≥ 1</span> → non-stationary signal; flagged and excluded from cross-gene comparisons.
              </p>
            </div>
          </div>

          {/* Historical Context */}
          <HistoricalContext />

          {/* Category toggles */}
          <div className="flex flex-wrap gap-2 mb-4">
            {ALL_CATS.map(cat => {
              const meta = CAT_META[cat];
              const active = selectedCats.has(cat);
              const cnt = catCounts[cat] ?? 0;
              return (
                <button key={cat} onClick={() => toggleCat(cat)} data-testid={`filter-category-${cat}`}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all select-none ${active ? 'text-white border-transparent shadow-sm' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'}`}
                  style={active ? { backgroundColor: meta.color, borderColor: meta.color } : {}}>
                  <span style={{ color: active ? 'white' : meta.color }}>●</span>
                  {meta.label}
                  {cnt > 0 && <span className="opacity-60">({cnt})</span>}
                </button>
              );
            })}
            {selectedCats.size > 0 && (
              <button onClick={() => { setSelectedCats(new Set()); setPage(1); }} className="px-3 py-1.5 rounded-full text-xs text-slate-500 bg-white border border-slate-200 hover:bg-slate-100" data-testid="button-clear-categories">
                ✕ Clear
              </button>
            )}
          </div>

          {/* Filter row */}
          <div className="flex flex-wrap gap-3 items-center mb-5">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400 pointer-events-none" />
              <Input placeholder="Search gene…" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} className="pl-8 w-44 h-9 bg-white text-sm" data-testid="input-search-gene" />
            </div>
            <Select value={selectedTissue} onValueChange={v => { setSelectedTissue(v); setPage(1); }}>
              <SelectTrigger className="w-44 h-9 bg-white text-sm" data-testid="select-tissue"><SelectValue placeholder="All tissues" /></SelectTrigger>
              <SelectContent><SelectItem value="all">All tissues</SelectItem>{allTissues.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={selectedOrganism} onValueChange={v => { setSelectedOrganism(v); setPage(1); }}>
              <SelectTrigger className="w-36 h-9 bg-white text-sm" data-testid="select-organism"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All organisms</SelectItem>
                <SelectItem value="Mouse">🐭 Mouse</SelectItem>
                <SelectItem value="Human">🧬 Human</SelectItem>
              </SelectContent>
            </Select>
            {view === 'table' && (
              <Select value={sortBy} onValueChange={v => { setSortBy(v as typeof sortBy); setPage(1); }}>
                <SelectTrigger className="w-48 h-9 bg-white text-sm" data-testid="select-sort"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="qvalue">FDR q-value low → high</SelectItem>
                  <SelectItem value="eigenvalue_desc">|λ| high → low</SelectItem>
                  <SelectItem value="eigenvalue_asc">|λ| low → high</SelectItem>
                  <SelectItem value="percentile">Genome %ile high → low</SelectItem>
                  <SelectItem value="cv_asc">Cross-tissue CV low → high</SelectItem>
                  <SelectItem value="phase">Peak CT earliest</SelectItem>
                  <SelectItem value="gene">Gene A → Z</SelectItem>
                  <SelectItem value="category">Category A → Z</SelectItem>
                </SelectContent>
              </Select>
            )}
            {data && <span className="text-sm text-slate-500 ml-1">{view === 'table' ? `${filtered.length.toLocaleString()} rows` : `${geneRows.length} genes`}</span>}
            {data && (selectedCats.size > 0 || search || selectedTissue !== 'all' || selectedOrganism !== 'all') && (
              <button className="text-xs underline text-slate-400 hover:text-slate-600" onClick={resetFilters} data-testid="button-reset-filters">reset</button>
            )}
            {data && (
              <div className="ml-auto flex rounded-lg border border-slate-200 overflow-hidden">
                <button onClick={() => setView('table')} data-testid="button-view-table"
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${view === 'table' ? 'bg-slate-800 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`}>
                  <Table2 className="h-3.5 w-3.5" />Table
                </button>
                <button onClick={() => setView('heatmap')} data-testid="button-view-heatmap"
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border-l border-slate-200 transition-colors ${view === 'heatmap' ? 'bg-slate-800 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`}>
                  <Grid3x3 className="h-3.5 w-3.5" />Heatmap
                </button>
              </div>
            )}
          </div>

          {/* Loading */}
          {isLoading && (
            <div className="bg-white border border-slate-200 rounded-xl p-16 text-center">
              <div className="inline-flex items-center gap-2 text-slate-500 text-sm">
                <div className="w-4 h-4 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
                Computing eigenvalues, phase, genome percentiles, FDR q-values, and disease Δλ…
              </div>
              <p className="text-slate-400 text-xs mt-2">Runs once per hour (cached). Includes all ~20k genes per tissue for percentile ranking + 200-permutation FDR correction per gene.</p>
            </div>
          )}

          {error && !isLoading && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-8 text-center">
              <p className="text-red-600 text-sm font-medium">Failed to load atlas</p>
              <p className="text-red-400 text-xs mt-1">{String(error)}</p>
            </div>
          )}

          {/* Views */}
          {data && !isLoading && !error && (
            <>
              {view === 'heatmap' && (
                <HeatmapView
                  genes={geneRows}
                  tissues={allTissues}
                  onGeneClick={setSelectedGene}
                  selectedCats={selectedCats}
                  selectedOrganism={selectedOrganism}
                  selectedTissue={selectedTissue}
                />
              )}

              {view === 'table' && (
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm min-w-[1000px]">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                          <th className="text-left px-4 py-3 font-semibold">Gene</th>
                          <th className="text-left px-3 py-3 font-semibold">Category</th>
                          <th className="text-left px-3 py-3 font-semibold">Tissue</th>
                          <th className="text-left px-3 py-3 font-semibold">|λ|</th>
                          <th className="text-left px-3 py-3 font-semibold">%ile</th>
                          <th className="text-left px-3 py-3 font-semibold">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="cursor-help border-b border-dotted border-slate-400">Q-val</span>
                              </TooltipTrigger>
                              <TooltipContent side="top">
                                <p className="text-xs font-medium">FDR-corrected q-value</p>
                                <p className="text-xs text-slate-400 mt-0.5">200-permutation null · Benjamini-Hochberg correction</p>
                              </TooltipContent>
                            </Tooltip>
                          </th>
                          <th className="text-left px-3 py-3 font-semibold">Roots</th>
                          <th className="text-left px-3 py-3 font-semibold">Peak CT</th>
                          <th className="text-left px-3 py-3 font-semibold">
                            {data?.datasetCaveats?.GSE157357 ? (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="cursor-help flex items-center gap-1 text-amber-700">
                                    ΔApcKO <span className="text-amber-500 text-[10px]">⚠</span>
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="max-w-xs">
                                  <p className="text-xs font-semibold text-amber-700 mb-1">Temporal coverage caveat — GSE157357</p>
                                  <p className="text-xs leading-relaxed">{data.datasetCaveats!.GSE157357}</p>
                                </TooltipContent>
                              </Tooltip>
                            ) : 'ΔApcKO'}
                          </th>
                          <th className="text-left px-3 py-3 font-semibold">Tier</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginated.map((e, idx) => {
                          const meta = CAT_META[e.category] ?? CAT_META.other;
                          const tier = e.eigenvalue >= 0.65
                            ? { label: 'High', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
                            : e.eigenvalue >= 0.45
                              ? { label: 'Mid', cls: 'bg-amber-50 text-amber-700 border-amber-200' }
                              : { label: 'Low', cls: 'bg-slate-100 text-slate-500 border-slate-200' };
                          return (
                            <tr key={`${e.gene}-${e.tissue}-${idx}`} data-testid={`row-atlas-${idx}`}
                              className={`border-b border-slate-100 hover:bg-violet-50/30 transition-colors cursor-pointer ${idx % 2 === 1 ? 'bg-slate-50/40' : ''}`}
                              onClick={() => setSelectedGene(e.gene)}>
                              <td className="px-4 py-2.5">
                                <div className="flex items-center gap-2">
                                  <div className="w-1 h-6 rounded-full flex-shrink-0" style={{ backgroundColor: meta.color }} />
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span className="font-semibold text-slate-900 whitespace-nowrap underline decoration-dotted decoration-slate-300 cursor-help">{e.gene}</span>
                                    </TooltipTrigger>
                                    <TooltipContent side="right" className="max-w-xs">
                                      <p className="text-xs leading-relaxed">{e.explanation}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                  {e.organism === 'Human' && <span className="text-[10px] bg-indigo-50 text-indigo-400 px-1.5 py-0.5 rounded font-medium border border-indigo-100">H</span>}
                                </div>
                              </td>
                              <td className="px-3 py-2.5">
                                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${meta.bg} ${meta.text}`}>{meta.label}</span>
                              </td>
                              <td className="px-3 py-2.5 text-slate-600 whitespace-nowrap text-xs">{e.tissue}</td>
                              <td className="px-3 py-2.5"><EigenBar value={e.eigenvalue} /></td>
                              <td className="px-3 py-2.5"><PercentileBadge p={e.genomePercentile} /></td>
                              <td className="px-3 py-2.5"><QBadge q={e.qValue} /></td>
                              <td className="px-3 py-2.5">
                                <span className={`text-xs font-medium px-2 py-0.5 rounded whitespace-nowrap ${e.isComplex ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-slate-100 text-slate-600 border border-slate-200'}`}>
                                  {e.isComplex ? '⊙ Complex' : '→ Real'}
                                </span>
                              </td>
                              <td className="px-3 py-2.5 text-slate-600 text-xs whitespace-nowrap tabular-nums">
                                {e.phase !== null ? (
                                  <span className="flex items-center gap-1">
                                    <span className="w-2 h-2 rounded-full inline-block flex-shrink-0" style={{
                                      background: `hsl(${(e.phase / 24) * 360}, 70%, 55%)`
                                    }} />
                                    CT{e.phase.toFixed(0)}
                                  </span>
                                ) : '—'}
                              </td>
                              <td className="px-3 py-2.5 text-xs tabular-nums whitespace-nowrap">
                                {e.diseaseDelta !== null ? (
                                  <span className="flex items-center gap-1" style={{ color: e.diseaseDelta < -0.02 ? '#ef4444' : e.diseaseDelta > 0.02 ? '#10b981' : '#94a3b8' }}>
                                    {e.diseaseDelta < -0.02 ? <TrendingDown className="h-3 w-3" /> : e.diseaseDelta > 0.02 ? <TrendingUp className="h-3 w-3" /> : null}
                                    {e.diseaseDelta >= 0 ? '+' : ''}{e.diseaseDelta.toFixed(3)}
                                  </span>
                                ) : <span className="text-slate-300">—</span>}
                              </td>
                              <td className="px-3 py-2.5">
                                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded border whitespace-nowrap ${tier.cls}`}>
                                  {tier.label}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                        {paginated.length === 0 && (
                          <tr><td colSpan={10} className="px-4 py-16 text-center text-slate-400 text-sm">No genes match current filters.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50">
                      <span className="text-xs text-slate-500">
                        {((page-1)*PAGE_SIZE+1).toLocaleString()}–{Math.min(page*PAGE_SIZE, filtered.length).toLocaleString()} of {filtered.length.toLocaleString()}
                      </span>
                      <div className="flex items-center gap-1">
                        <Button variant="outline" size="sm" disabled={page<=1} onClick={() => setPage(p=>p-1)} data-testid="button-prev-page">← Prev</Button>
                        <span className="px-3 py-1.5 text-xs text-slate-600 tabular-nums">{page} / {totalPages}</span>
                        <Button variant="outline" size="sm" disabled={page>=totalPages} onClick={() => setPage(p=>p+1)} data-testid="button-next-page">Next →</Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* Method note */}
          <div className="mt-5 bg-white border border-slate-200 rounded-lg px-5 py-3.5 flex gap-3">
            <Info className="h-4 w-4 text-slate-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-slate-500 leading-relaxed">
              <strong className="text-slate-600">Method:</strong> AR(2) OLS on mean-centred FPKM/TPM time series. |λ| = dominant characteristic root modulus. Complex roots → oscillatory dynamics; real roots → monotone decay.{' '}
              <strong className="text-slate-600">R²</strong> = OLS goodness-of-fit (fraction of variance explained by the AR(2) model).{' '}
              <strong className="text-slate-600">Phase</strong> = cosinor acrophase at the gene's implied period (peak CT hour, 0–24; only for complex-root genes).{' '}
              <strong className="text-slate-600">%ile</strong> = genome percentile among all ~20k genes in that tissue.{' '}
              <strong className="text-slate-600">Q-val</strong> = Benjamini-Hochberg FDR q-value (200-permutation null; green = q &lt; 0.01, amber = q &lt; 0.05).{' '}
              <strong className="text-slate-600">ΔApcKO</strong> = |λ|_ApcKO − |λ|_WT (GSE157357, Stokes et al. 2021; negative = circadian memory lost in APC-loss cancer).{data?.datasetCaveats?.GSE157357 && <>{' '}<span className="text-amber-600 font-semibold">⚠ Caveat:</span> {data.datasetCaveats.GSE157357}</>}{' '}
              <strong className="text-slate-600">CV low → high</strong> sort surfaces genes most consistent across tissues — best candidates for cross-tissue validation.{' '}
              <strong className="text-slate-600">Mouse:</strong> GSE54650 (Zhang et al. 2014, 12 tissues, 2h sampling).{' '}
              <strong className="text-slate-600">Human Blood / Whole Blood:</strong> GSE48113 (Archer et al. 2014, circadian forced desynchrony protocol) and GSE113883 (Braun et al. 2018, PNAS — TimeSignature circadian profiling study; 11 healthy adults, 2h sampling over 28h constant routine) — both included for cross-validation; their separate columns confirm whether a signal is protocol-specific.{' '}
              <strong className="text-slate-600">Human Enteroid:</strong> GSE161566 (Rosselot et al. 2022).
            </p>
          </div>
        </div>
      </div>

      {selectedGene && data && (
        <GeneDrawer gene={selectedGene} data={data} catMeans={catMeans} onClose={() => setSelectedGene(null)} onGeneClick={setSelectedGene} />
      )}
    </TooltipProvider>
  );
}
