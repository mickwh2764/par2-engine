---
name: testing-par2-platform
description: How to build, run and end-to-end test the PAR(2) Discovery Engine platform locally (production build, route crawl, download endpoints), including which failures are pre-existing environment artifacts rather than regressions.
---

# Testing the PAR(2) Discovery Engine locally

## Build and run the production bundle

```bash
npm install                     # Node 20.18.1 is fine; Vite warns it prefers 20.19+/22.12+ — do NOT upgrade
npm run build                   # tsx script/build.ts -> dist/index.cjs + dist/public/
npm test                        # vitest; expect "Test Files 2 passed / Tests 8 passed"
docker start par2pg || docker run -d --name par2pg -e POSTGRES_PASSWORD=pg -p 5432:5432 postgres:16-alpine
PORT=5055 NODE_ENV=production SESSION_SECRET=localtest \
  DATABASE_URL=postgres://postgres:pg@127.0.0.1:5432/postgres node dist/index.cjs
```

`npm run check` (tsc) reports ~50 pre-existing errors — compare the count/content against `main`
before treating any as new. `client/public/sitemap.xml` is rewritten by every build; that diff is expected noise.

## Always build a `main` baseline on a second port

Many pages and endpoints fail locally for environment reasons, so an absolute pass/fail judgement is
misleading. Create a worktree of the base branch, build it, serve it on another port (e.g. 5056), and
diff outcomes route-by-route and endpoint-by-endpoint. "Differs from base branch" is the only reliable
regression signal here.

## Route coverage

`client/public/routes.json` is both the route list **and** the server's SPA-fallback allowlist. A page
routed in `client/src/App.tsx` but missing from `routes.json` returns a hard HTTP 404 from the server
(observed for `/manuscript-validation`). When crawling, drive Playwright from `routes.json`, and
separately check that every `<Route path=...>` in `App.tsx` appears in `routes.json`.

Route paths do not always match component filenames: the `manuscript-download` page is served at
`/manuscript`. Grep `App.tsx` for the component name rather than guessing the URL.

For Playwright in this environment: `python3 -m playwright install chromium` first. Do not point
Playwright at `/home/ubuntu/.local/bin/google-chrome` — it is a wrapper for an external browser service.
Prefer `wait_until="load"` plus a short settle over `networkidle`; `/convergence-map` polls and never
reaches networkidle (45s timeout on any branch).

Detect crashes by looking for the ErrorBoundary text **"Something went wrong"**
(`client/src/components/ErrorBoundary.tsx`), plus console errors matching
`/dynamically imported module|Failed to resolve|Cannot find module|is not exported/` — that regex is how a
wrongly-removed dependency surfaces, since Vite code-splits per page and the build alone will not catch it.

## Features that work without a database (best for real end-to-end proof)

- `/discovery-engine`: pick a sample dataset (e.g. "Synthetic Multi-Channel") → **Run AR(2) Analysis**.
  Everything is computed in the browser; you get eigenvalues, φ₁/φ₂, R², Ljung-Box, ADF and integrity checks.
- `/model-zoo`: computes the ODE→AR(2) round-trip table (expect 6/6 PASS) and **Download Results (CSV)** works.
- `/discovery-engine` → **Download Report** emits a populated HTML report (not a PDF).
- `/api/v1/health` and `/api/download/python-package` (zip named `par2-circadian-1.1.5.zip`) work with no DB.

## Known pre-existing local failures (verify against base branch before reporting as bugs)

- Nine analysis pages render the ErrorBoundary with `Cannot read properties of null/undefined`
  (`/validation-suite`, `/method-validation`, `/species-comparison`, `/clock-target-phi`,
  `/cross-context-validation`, `/cross-tissue-three-layer`, `/eigenvalue-independence`,
  `/phase-sensitivity`, `/phi-enrichment-replication`) — they need dataset/DB payloads.
- DB-backed routes 500 with `ECONNREFUSED 127.0.0.1:443`: `server/db.ts` uses
  `drizzle-orm/neon-serverless` + `@neondatabase/serverless`, which dials Neon over WSS on :443 even when
  `DATABASE_URL` points at a local postgres. A local postgres therefore cannot serve these routes; a real
  Neon URL would be needed.
- `/api/datasets/embedded` 500s with `ENOENT ... /datasets` — `datasets/` is gitignored and absent.
- Paper package zips (`/api/download/*-package`) return HTTP 200 but an empty 22-byte zip, because
  `paper-packages/` PDFs are untracked (only `paper-g-fibonacci-reply/` is in git).
- `/api/download/manuscript-pdf-with-figures` 404s: `manuscripts/PAR2_Complete_Manuscript.pdf` is not committed.
- `/gene-explorer` shows inline `Error: Failed to fetch enrichment data` (DB-backed).

## Verifying a dependency/file-deletion PR

Grep the *built* output, not just source, since dynamic paths hide from source greps:

```bash
grep -ro -- "<removed-package-or-deleted-filename>" dist/index.cjs dist/public/assets/*.js | wc -l
```

Expect 0. Note that a bare string like `docx` may legitimately appear as UI text/filename copy rather
than an import — check the surrounding context before reporting it.

## Do not test against par2discovery.com

The live site serves a stale build predating recent merges; its behaviour says nothing about a PR.

## Devin Secrets Needed

None for the above. A real Neon-compatible `DATABASE_URL` (and a populated `datasets/` directory) would be
required to test the DB-backed dashboard analysis and the nine data-driven analysis pages.
