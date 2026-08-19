import type { Express, Request, Response } from "express";
import { getAllPaperStatuses, getPaperStatus, enqueueCompile, enqueueStale, PAPERS } from "../paper-compiler";
import { checkPasswordRateLimit, recordFailedAttempt, clearAttempts } from "./analytics";

function requireAdmin(req: Request, res: Response): boolean {
  if (!checkPasswordRateLimit(req, res)) return false;
  const { password } = req.body as { password?: string };
  const expected = process.env.DOWNLOAD_PROTECT_PASSWORD;
  if (!expected || password !== expected) {
    recordFailedAttempt(req, res);
    return false;
  }
  clearAttempts(req);
  return true;
}

export function registerPaperRoutes(app: Express): void {
  app.get("/api/papers/status", (_req: Request, res: Response) => {
    const statuses = getAllPaperStatuses();
    const summary = {
      total: statuses.length,
      ok: statuses.filter((s) => s.status === "ok").length,
      stale: statuses.filter((s) => s.status === "stale").length,
      compiling: statuses.filter((s) => s.status === "compiling").length,
      error: statuses.filter((s) => s.status === "error").length,
    };
    res.json({ summary, papers: statuses });
  });

  app.post("/api/papers/recompile", async (req: Request, res: Response) => {
    if (!requireAdmin(req, res)) return;

    const { ids } = req.body as { ids?: string[] };

    if (ids && ids.length > 0) {
      const valid = ids.filter((id) => PAPERS.find((p) => p.id === id));
      if (valid.length === 0) {
        res.status(400).json({ error: "No valid paper IDs provided" });
        return;
      }
      enqueueCompile(valid);
      res.json({ queued: valid, message: `Queued ${valid.length} paper(s) for recompilation` });
    } else {
      const count = await enqueueStale();
      res.json({ queued: count, message: count > 0 ? `Queued ${count} stale paper(s)` : "All PDFs already up to date" });
    }
  });

  app.post("/api/papers/recompile-all", (req: Request, res: Response) => {
    if (!requireAdmin(req, res)) return;

    const allIds = PAPERS.map((p) => p.id);
    enqueueCompile(allIds);
    res.json({ queued: allIds.length, message: `Queued all ${allIds.length} papers for recompilation` });
  });
}
