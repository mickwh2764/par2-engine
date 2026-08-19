import { execFile, spawn } from "child_process";
import fs from "fs";
import path from "path";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

export type CompileStatus = "ok" | "stale" | "compiling" | "error" | "missing";

export interface PaperEntry {
  id: string;
  label: string;
  dir: string;
  pdf: string;
  /** pdflatex papers: .tex filename within dir */
  tex?: string;
  /** pandoc papers: path to canonical .md source, relative to project root */
  manuscriptSource?: string;
  /** pandoc papers: .md filename to write inside dir before compiling */
  pkgMdName?: string;
}

export interface PaperStatus extends PaperEntry {
  status: CompileStatus;
  /** mtime of the primary source file (.tex or .md) */
  sourceMtime: number | null;
  /** @deprecated alias for sourceMtime — kept for API compatibility */
  texMtime: number | null;
  pdfMtime: number | null;
  pages: number | null;
  sizeBytes: number | null;
  lastCompiled: Date | null;
  lastError: string | null;
}

export const PAPERS: PaperEntry[] = [
  // ── pdflatex papers ───────────────────────────────────────────────────────
  // Paper A is under review — do not auto-recompile from the registry.
  // Paper G is published (The Fibonacci Quarterly, doi:10.1080/00150517.2026.2716122).
  //   Paper_G_Fibonacci_Reply.pdf is the author accepted manuscript (Revision_v1).
  //   Do NOT recompile from .tex — it would overwrite the accepted version.
  {
    id: "paper-ad",
    label: "Paper AD — Glial Clock Inversion",
    dir: "paper-packages/paper-ad-glial",
    tex: "Paper_AD_Glial_Clock_Inversion.tex",
    pdf: "Paper_AD_Glial_Clock_Inversion.pdf",
  },
  {
    id: "paper-b",
    label: "Paper B — Resonance Zone",
    dir: "paper-packages/paper-b-resonance-zone",
    tex: "Paper_B_Resonance_Zone.tex",
    pdf: "Paper_B_Resonance_Zone.pdf",
  },
  {
    id: "paper-c",
    label: "Paper C — Coupling Atlas",
    dir: "paper-packages/paper-c-coupling-atlas",
    tex: "Paper_C_Coupling_Atlas.tex",
    pdf: "Paper_C_Coupling_Atlas.pdf",
  },
  {
    id: "paper-d",
    label: "Paper D — Perspective",
    dir: "paper-packages/paper-d-perspective",
    tex: "Paper_D_Perspective.tex",
    pdf: "Paper_D_Perspective.pdf",
  },
  {
    id: "paper-e",
    label: "Paper E — Cell Systems",
    dir: "paper-packages/paper-e-cell-systems",
    tex: "Paper_E_Phase_Gated_PAR2.tex",
    pdf: "Paper_E_Phase_Gated_PAR2.pdf",
  },
  {
    id: "paper-f",
    label: "Paper F — Expression Persistence",
    dir: "paper-packages/paper-f-expression-persistence",
    tex: "Paper_F_Expression_Persistence.tex",
    pdf: "Paper_F_Expression_Persistence.pdf",
  },
  // Paper G removed — published, accepted PDF in place, do not recompile.
  {
    id: "paper-p",
    label: "Paper P — Temporal Correlation",
    dir: "paper-packages/paper-p-temporal-correlation",
    tex: "Paper_P_Temporal_Correlation.tex",
    pdf: "Paper_P_Temporal_Correlation.pdf",
  },

  // ── pandoc papers (md → pdf) ──────────────────────────────────────────────
  {
    id: "paper-o",
    label: "Paper O — Intestinal Organoid Hierarchy",
    dir: "paper-packages/paper-o-organoid",
    manuscriptSource: "manuscripts/paper_o_organoid.md",
    pkgMdName: "PaperO_Organoid_Circadian_Hierarchy.md",
    pdf: "PaperO_Organoid_Circadian_Hierarchy.pdf",
  },
  {
    id: "paper-q",
    label: "Paper Q — Central-Peripheral Clock",
    dir: "paper-packages/paper-q-light-entrainment",
    manuscriptSource: "manuscripts/paper_q_light_entrainment.md",
    pkgMdName: "PaperQ_LightEntrainment_Manuscript.md",
    pdf: "PaperQ_LightEntrainment_Manuscript.pdf",
  },
  {
    id: "methods-platform",
    label: "Methods Platform",
    dir: "paper-packages/methods-platform",
    manuscriptSource: "paper-packages/methods-platform/PAR2_Methods_Platform_Paper.md",
    pkgMdName: "PAR2_Methods_Platform_Paper.md",
    pdf: "PAR2_Methods_Platform_Paper.pdf",
  },
  {
    id: "paper-n",
    label: "Paper N — p53 Regulon",
    dir: "paper-packages/paper-n-p53-regulon",
    manuscriptSource: "manuscripts/paper_n_p53_CDD.md",
    pkgMdName: "PaperN_p53_Regulon.md",
    pdf: "PaperN_p53_Regulon.pdf",
  },
  {
    id: "paper-r",
    label: "Paper R — Segmentation Clock",
    dir: "paper-packages/paper-r-segmentation-clock",
    manuscriptSource: "paper-packages/paper-r-segmentation-clock/Paper_R_Segmentation_Clock.md",
    pkgMdName: "Paper_R_Segmentation_Clock.md",
    pdf: "Paper_R_Segmentation_Clock.pdf",
  },
];

const _statusMap = new Map<string, PaperStatus>();

function mtimeSafe(filePath: string): number | null {
  try {
    return fs.statSync(filePath).mtimeMs;
  } catch {
    return null;
  }
}

function fileSizeSafe(filePath: string): number | null {
  try {
    return fs.statSync(filePath).size;
  } catch {
    return null;
  }
}

async function getPdfPages(pdfPath: string): Promise<number | null> {
  try {
    const { stdout } = await execFileAsync("pdfinfo", [pdfPath], { timeout: 5000 });
    const match = stdout.match(/Pages:\s+(\d+)/);
    return match ? parseInt(match[1], 10) : null;
  } catch {
    return null;
  }
}

function computeStatus(paper: PaperEntry): Omit<PaperStatus, "lastCompiled" | "lastError"> & { lastCompiled: null; lastError: null } {
  const cwd = process.cwd();
  const pdfPath  = path.join(cwd, paper.dir, paper.pdf);
  const pdfMtime = mtimeSafe(pdfPath);
  const sizeBytes = fileSizeSafe(pdfPath);

  // Resolve the primary source file: .tex for pdflatex, .md for pandoc
  let sourcePath: string;
  if (paper.tex) {
    sourcePath = path.join(cwd, paper.dir, paper.tex);
  } else if (paper.manuscriptSource) {
    sourcePath = path.isAbsolute(paper.manuscriptSource)
      ? paper.manuscriptSource
      : path.join(cwd, paper.manuscriptSource);
  } else {
    // No source defined — treat as always ok (manual PDF)
    return { ...paper, status: "ok", sourceMtime: null, texMtime: null, pdfMtime, pages: null, sizeBytes, lastCompiled: null, lastError: null };
  }

  const sourceMtime = mtimeSafe(sourcePath);

  let status: CompileStatus;
  if (sourceMtime === null) {
    status = "missing";
  } else if (pdfMtime === null) {
    status = "stale";
  } else if (sourceMtime > pdfMtime) {
    status = "stale";
  } else {
    status = "ok";
  }

  return {
    ...paper,
    status,
    sourceMtime,
    texMtime: sourceMtime, // alias for backward compatibility
    pdfMtime,
    pages: null,
    sizeBytes,
    lastCompiled: null,
    lastError: null,
  };
}

export function getAllPaperStatuses(): PaperStatus[] {
  return PAPERS.map((p) => {
    const cached = _statusMap.get(p.id);
    if (cached) return cached;
    const computed = computeStatus(p);
    return { ...computed, lastCompiled: null, lastError: null };
  });
}

export function getPaperStatus(id: string): PaperStatus | null {
  const paper = PAPERS.find((p) => p.id === id);
  if (!paper) return null;
  const cached = _statusMap.get(id);
  if (cached) return cached;
  const computed = computeStatus(paper);
  return { ...computed, lastCompiled: null, lastError: null };
}

let _compileQueue: string[] = [];
let _compileRunning = false;

async function runPdflatex(paper: PaperEntry): Promise<void> {
  if (!paper.tex) throw new Error(`Paper ${paper.id} has no .tex source`);
  const cwd  = path.join(process.cwd(), paper.dir);
  const args = ["-interaction=nonstopmode", paper.tex];

  for (let pass = 1; pass <= 2; pass++) {
    await new Promise<void>((resolve, reject) => {
      const proc = spawn("pdflatex", args, { cwd, stdio: "pipe" });
      let stderr = "";
      proc.stderr?.on("data", (d) => { stderr += d.toString(); });
      proc.on("close", (code) => {
        const pdfPath = path.join(cwd, paper.pdf);
        const exists = fs.existsSync(pdfPath) && (fileSizeSafe(pdfPath) ?? 0) > 10_000;
        if (exists) resolve();
        else reject(new Error(`pdflatex pass ${pass} failed (exit ${code}): ${stderr.slice(-300)}`));
      });
      proc.on("error", reject);
    });
  }
}

async function fixGreekSymbols(mdPath: string): Promise<void> {
  const script = path.join(process.cwd(), "scripts", "fix_greek_math_mode.py");
  if (!fs.existsSync(script)) return;
  try {
    await execFileAsync("python3", [script, mdPath], { timeout: 20_000 });
  } catch (e) {
    console.warn(`[paper-compiler] Greek-fix warning for ${path.basename(mdPath)}:`, e);
  }
}

async function runPandoc(paper: PaperEntry): Promise<void> {
  if (!paper.manuscriptSource || !paper.pkgMdName) {
    throw new Error(`Paper ${paper.id} missing manuscriptSource or pkgMdName`);
  }
  const root       = process.cwd();
  const sourceAbs  = path.isAbsolute(paper.manuscriptSource)
    ? paper.manuscriptSource
    : path.join(root, paper.manuscriptSource);
  const pkgMdAbs   = path.join(root, paper.dir, paper.pkgMdName);
  const pdfAbs     = path.join(root, paper.dir, paper.pdf);

  // Sync .md into package dir when canonical source lives elsewhere
  if (path.resolve(sourceAbs) !== path.resolve(pkgMdAbs)) {
    fs.copyFileSync(sourceAbs, pkgMdAbs);
  }
  await fixGreekSymbols(pkgMdAbs);
  await execFileAsync("pandoc", [
    pkgMdAbs,
    "-o", pdfAbs,
    "--pdf-engine=xelatex",
    "-V", "geometry:margin=1in",
    "-V", "fontsize=11pt",
    "-V", "mainfont=DejaVu Serif",
    "-V", "monofont=DejaVu Sans Mono",
    "--toc",
  ], { timeout: 120_000 });
}

async function processQueue(): Promise<void> {
  if (_compileRunning) return;
  _compileRunning = true;

  while (_compileQueue.length > 0) {
    const id = _compileQueue.shift()!;
    const paper = PAPERS.find((p) => p.id === id);
    if (!paper) continue;

    const current = getPaperStatus(id)!;
    _statusMap.set(id, { ...current, status: "compiling", lastError: null });
    console.log(`[paper-compiler] Compiling ${paper.label}...`);

    try {
      if (paper.tex) {
        await runPdflatex(paper);
      } else {
        await runPandoc(paper);
      }
      const pdfAbsPath = path.join(process.cwd(), paper.dir, paper.pdf);
      const pages     = await getPdfPages(pdfAbsPath);
      const sizeBytes = fileSizeSafe(pdfAbsPath);
      const pdfMtime  = mtimeSafe(pdfAbsPath);
      // Resolve source mtime for updated status
      let sourceMtime: number | null = null;
      if (paper.tex) {
        sourceMtime = mtimeSafe(path.join(process.cwd(), paper.dir, paper.tex));
      } else if (paper.manuscriptSource) {
        const src = path.isAbsolute(paper.manuscriptSource)
          ? paper.manuscriptSource
          : path.join(process.cwd(), paper.manuscriptSource);
        sourceMtime = mtimeSafe(src);
      }
      _statusMap.set(id, {
        ...paper,
        status: "ok",
        sourceMtime,
        texMtime: sourceMtime,
        pdfMtime,
        pages,
        sizeBytes,
        lastCompiled: new Date(),
        lastError: null,
      });
      console.log(`[paper-compiler] ✓ ${paper.label} — ${pages} pages`);
    } catch (err: any) {
      const current2 = getPaperStatus(id)!;
      _statusMap.set(id, {
        ...current2,
        status: "error",
        lastError: err.message ?? String(err),
      });
      console.error(`[paper-compiler] ✗ ${paper.label}: ${err.message}`);
    }
  }

  _compileRunning = false;
}

export function enqueueCompile(ids: string[]): void {
  for (const id of ids) {
    if (!_compileQueue.includes(id)) {
      const current = _statusMap.get(id) ?? computeStatus(PAPERS.find((p) => p.id === id)!);
      if (current.status !== "compiling") {
        _compileQueue.push(id);
        _statusMap.set(id, { ...current, status: "compiling", lastError: null } as PaperStatus);
      }
    }
  }
  processQueue().catch((e) => console.error("[paper-compiler] Queue error:", e));
}

export async function enqueueStale(): Promise<number> {
  const stale = PAPERS.filter((p) => {
    const s = getPaperStatus(p.id);
    return s?.status === "stale";
  });
  if (stale.length > 0) {
    console.log(`[paper-compiler] ${stale.length} stale paper(s) queued for recompilation: ${stale.map((p) => p.id).join(", ")}`);
    enqueueCompile(stale.map((p) => p.id));
  } else {
    console.log("[paper-compiler] All PDFs are up to date.");
  }
  return stale.length;
}
