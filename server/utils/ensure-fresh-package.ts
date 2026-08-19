/**
 * ensure-fresh-package.ts
 *
 * Before serving a paper package zip, checks whether the compiled PDF is
 * older than its source file (.md or .tex). If stale, recompiles
 * in-place so the downloaded zip always contains a current PDF.
 *
 * - Pandoc papers: manuscript .md (from manuscripts/ or within the package
 *   dir) → PDF via xelatex. Greek symbols are auto-fixed before compile.
 * - pdflatex papers: .tex within the package dir → PDF via pdflatex (×2).
 * - Paper A is deliberately excluded — it is the submitted version under
 *   peer review and must not be auto-modified.
 *
 * Errors are caught and logged; the download proceeds regardless.
 */

import fs   from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);
const ROOT = path.resolve(process.cwd());

// ── Config types ──────────────────────────────────────────────────────────────

interface PandocConfig {
  kind: 'pandoc';
  /** Path to authoritative .md source, relative to ROOT.
   *  May live in manuscripts/ or inside the package dir itself. */
  manuscriptSource: string;
  /** Filename (.md) to write/keep inside pkgDir for the compile step.
   *  If different from manuscriptSource, the source is copied here first. */
  pkgMdName: string;
  /** PDF filename within pkgDir */
  pdfName: string;
}

interface PdflatexConfig {
  kind: 'pdflatex';
  /** .tex filename within pkgDir */
  texName: string;
  /** PDF filename within pkgDir */
  pdfName: string;
}

type PackageConfig = PandocConfig | PdflatexConfig;

// ── Per-route configuration ───────────────────────────────────────────────────
// Keyed by the download route name (e.g. 'paper-o-package').

const PACKAGE_CONFIGS: Record<string, PackageConfig> = {

  // ── Pandoc (md → pdf) ─────────────────────────────────────────────────────

  'paper-o-package': {
    kind: 'pandoc',
    manuscriptSource: 'manuscripts/paper_o_organoid.md',
    pkgMdName:        'PaperO_Organoid_Circadian_Hierarchy.md',
    pdfName:          'PaperO_Organoid_Circadian_Hierarchy.pdf',
  },

  'paper-q-package': {
    kind: 'pandoc',
    manuscriptSource: 'manuscripts/paper_q_light_entrainment.md',
    pkgMdName:        'PaperQ_LightEntrainment_Manuscript.md',
    pdfName:          'PaperQ_LightEntrainment_Manuscript.pdf',
  },

  'paper-u-package': {
    kind: 'pandoc',
    manuscriptSource: 'manuscripts/paper_u_spaceflight_colon.md',
    pkgMdName:        'PaperU_Spaceflight_Colon.md',
    pdfName:          'PaperU_Spaceflight_Colon.pdf',
  },

  // Methods-platform: canonical source lives inside the package dir itself
  'methods-platform-package': {
    kind: 'pandoc',
    manuscriptSource: 'paper-packages/methods-platform/PAR2_Methods_Platform_Paper.md',
    pkgMdName:        'PAR2_Methods_Platform_Paper.md',
    pdfName:          'PAR2_Methods_Platform_Paper.pdf',
  },

  // Paper N: canonical source is in manuscripts/; package dir has only the PDF
  'paper-n-package': {
    kind: 'pandoc',
    manuscriptSource: 'manuscripts/paper_n_p53_CDD.md',
    pkgMdName:        'PaperN_p53_Regulon.md',
    pdfName:          'PaperN_p53_Regulon.pdf',
  },

  // ── pdflatex (tex → pdf) ──────────────────────────────────────────────────

  'paper-h-package': {
    kind: 'pdflatex',
    texName: 'Paper_AD_Glial_Clock_Inversion.tex',
    pdfName: 'Paper_AD_Glial_Clock_Inversion.pdf',
  },

  'paper-p-package': {
    kind: 'pdflatex',
    texName: 'Paper_P_Temporal_Correlation.tex',
    pdfName: 'Paper_P_Temporal_Correlation.pdf',
  },

  'paper-e-package': {
    kind: 'pdflatex',
    texName: 'Paper_E_Phase_Gated_PAR2.tex',
    pdfName: 'Paper_E_Phase_Gated_PAR2.pdf',
  },

  'paper-f-package': {
    kind: 'pdflatex',
    texName: 'Paper_F_Expression_Persistence.tex',
    pdfName: 'Paper_F_Expression_Persistence.pdf',
  },

  'paper-b-package': {
    kind: 'pdflatex',
    texName: 'Paper_B_Resonance_Zone.tex',
    pdfName: 'Paper_B_Resonance_Zone.pdf',
  },

  'paper-c-package': {
    kind: 'pdflatex',
    texName: 'Paper_C_Coupling_Atlas.tex',
    pdfName: 'Paper_C_Coupling_Atlas.pdf',
  },

  'paper-d-package': {
    kind: 'pdflatex',
    texName: 'Paper_D_Perspective.tex',
    pdfName: 'Paper_D_Perspective.pdf',
  },

  // paper-a-package is intentionally absent: it is the submitted version
  // under peer review at Chronobiology International and must not be
  // auto-recompiled.
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function mtimeMs(filePath: string): number {
  try { return fs.statSync(filePath).mtimeMs; }
  catch { return 0; }
}

async function fixGreekSymbols(mdPath: string): Promise<void> {
  const script = path.join(ROOT, 'scripts', 'fix_greek_math_mode.py');
  if (!fs.existsSync(script)) return;
  try {
    await execFileAsync('python3', [script, mdPath], { timeout: 20_000 });
  } catch (e) {
    console.warn(`[ensure-fresh-package] Greek-fix warning for ${mdPath}:`, e);
  }
}

async function pandocCompile(mdPath: string, pdfPath: string): Promise<void> {
  await execFileAsync('pandoc', [
    mdPath,
    '-o', pdfPath,
    '--pdf-engine=xelatex',
    '-V', 'geometry:margin=1in',
    '-V', 'fontsize=11pt',
    '-V', 'mainfont=DejaVu Serif',
    '-V', 'monofont=DejaVu Sans Mono',
    '--toc',
  ], { timeout: 120_000 });
}

async function pdflatexCompile(pkgDir: string, texName: string): Promise<void> {
  const opts = { cwd: pkgDir, timeout: 120_000 };
  // Two passes for cross-references
  await execFileAsync('pdflatex',
    ['-interaction=nonstopmode', '-halt-on-error', texName], opts);
  await execFileAsync('pdflatex',
    ['-interaction=nonstopmode', '-halt-on-error', texName], opts);
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Call before zipping a paper package. If the source file (.md or .tex) is
 * newer than the compiled PDF in pkgDir, recompiles the PDF in-place.
 * Never throws — compilation errors are logged and the download continues
 * with whatever PDF currently exists.
 *
 * @param pkgRoute  Route name, e.g. 'paper-o-package'
 * @param pkgDir    Absolute path to the paper-packages/{dir}/ directory
 */
export async function ensureFreshPackage(
  pkgRoute: string,
  pkgDir:   string,
): Promise<void> {
  const cfg = PACKAGE_CONFIGS[pkgRoute];
  if (!cfg) return; // not configured (paper-a, flagship, etc.) → skip

  if (cfg.kind === 'pandoc') {
    const sourceAbs = path.isAbsolute(cfg.manuscriptSource)
      ? cfg.manuscriptSource
      : path.join(ROOT, cfg.manuscriptSource);
    const pkgMdAbs  = path.join(pkgDir, cfg.pkgMdName);
    const pdfAbs    = path.join(pkgDir, cfg.pdfName);

    if (!fs.existsSync(sourceAbs)) {
      console.warn(`[ensure-fresh-package] Source not found, skipping: ${sourceAbs}`);
      return;
    }

    const sourceMtime = mtimeMs(sourceAbs);
    const pdfMtime    = mtimeMs(pdfAbs);

    if (sourceMtime <= pdfMtime) return; // PDF already current

    const lag = Math.round((sourceMtime - pdfMtime) / 1000);
    console.log(`[ensure-fresh-package] ${cfg.pdfName} is stale by ${lag}s — recompiling…`);
    try {
      // Sync .md into package dir when canonical source lives elsewhere
      if (path.resolve(sourceAbs) !== path.resolve(pkgMdAbs)) {
        fs.copyFileSync(sourceAbs, pkgMdAbs);
      }
      await fixGreekSymbols(pkgMdAbs);
      await pandocCompile(pkgMdAbs, pdfAbs);
      console.log(`[ensure-fresh-package] ✓ ${cfg.pdfName} recompiled (pandoc)`);
    } catch (err) {
      console.error(`[ensure-fresh-package] Pandoc compile failed for ${cfg.pdfName}:`, err);
    }

  } else { // pdflatex
    const texAbs = path.join(pkgDir, cfg.texName);
    const pdfAbs = path.join(pkgDir, cfg.pdfName);

    if (!fs.existsSync(texAbs)) {
      console.warn(`[ensure-fresh-package] .tex not found, skipping: ${texAbs}`);
      return;
    }

    const texMtime = mtimeMs(texAbs);
    const pdfMtime = mtimeMs(pdfAbs);

    if (texMtime <= pdfMtime) return; // PDF already current

    const lag = Math.round((texMtime - pdfMtime) / 1000);
    console.log(`[ensure-fresh-package] ${cfg.pdfName} is stale by ${lag}s — recompiling…`);
    try {
      await pdflatexCompile(pkgDir, cfg.texName);
      console.log(`[ensure-fresh-package] ✓ ${cfg.pdfName} recompiled (pdflatex)`);
    } catch (err) {
      console.error(`[ensure-fresh-package] pdflatex compile failed for ${cfg.pdfName}:`, err);
    }
  }
}
