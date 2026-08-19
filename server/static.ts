import express, { type Express } from "express";
import fs from "fs";
import path from "path";

export interface RouteManifest {
  exact: Set<string>;
  patterns: RegExp[];
}

/** Paths served by the SPA, written at build time by script/generate-sitemap.ts. */
function loadKnownRoutes(distPath: string): RouteManifest | null {
  try {
    const manifest = JSON.parse(fs.readFileSync(path.join(distPath, "routes.json"), "utf-8"));
    if (Array.isArray(manifest.routes) && manifest.routes.length > 0) {
      const patterns: string[] = Array.isArray(manifest.patterns) ? manifest.patterns : [];
      return {
        exact: new Set<string>(manifest.routes),
        // "/shared/:id" → /^\/shared\/[^/]+$/
        patterns: patterns.map(
          (pattern) =>
            new RegExp(`^${pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/:[^/]+/g, "[^/]+")}$`),
        ),
      };
    }
  } catch {
    // No manifest (older build): fall back to answering every path with 200.
  }
  return null;
}

/** Trailing punctuation swept up when a URL is cited inside prose, e.g. "(…/publications.bib)." */
const TRAILING_PUNCTUATION = /[).,;:!?'"\]>]+$/;

function isServable(distPath: string, knownRoutes: RouteManifest | null, requestPath: string) {
  if (requestPath.includes("\0")) return false;
  const filePath = path.resolve(distPath, `.${requestPath}`);
  if (filePath.startsWith(distPath + path.sep) && fs.existsSync(filePath)) return true;
  if (!knownRoutes) return false;
  return (
    knownRoutes.exact.has(requestPath) ||
    knownRoutes.patterns.some((pattern) => pattern.test(requestPath))
  );
}

/** The clean URL a punctuation-suffixed request should redirect to, or null to serve it as-is. */
export function punctuationRedirectTarget(
  distPath: string,
  knownRoutes: RouteManifest | null,
  originalUrl: string,
): string | null {
  const [rawPath, query] = originalUrl.split(/(?=\?)/, 2);
  let requestPath: string;
  try {
    requestPath = decodeURIComponent(rawPath);
  } catch {
    return null;
  }
  if (!TRAILING_PUNCTUATION.test(requestPath)) return null;
  const cleanPath = requestPath.replace(TRAILING_PUNCTUATION, "");
  if (!cleanPath || !isServable(distPath, knownRoutes, cleanPath)) return null;
  return `${encodeURI(cleanPath)}${query ?? ""}`;
}

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  const knownRoutes = loadKnownRoutes(distPath);

  // Crawlers that extract URLs from plain text keep the punctuation that
  // followed them in the sentence. Send those to the real path instead of a 404.
  app.use((req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") return next();
    const target = punctuationRedirectTarget(distPath, knownRoutes, req.originalUrl);
    if (!target) return next();
    return res.redirect(301, target);
  });

  app.use(
    express.static(distPath, {
      setHeaders: (res, filePath) => {
        // Vite fingerprints everything under /assets, so it can be cached
        // forever; index.html and the crawl files must stay fresh.
        if (filePath.includes(`${path.sep}assets${path.sep}`)) {
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        } else {
          res.setHeader("Cache-Control", "public, max-age=0, must-revalidate");
        }
        // .bib has no registered mime type, so express would send it as
        // octet-stream and browsers would download it instead of showing it.
        if (filePath.endsWith(".bib")) {
          res.setHeader("Content-Type", "text/plain; charset=utf-8");
        }
      },
    }),
  );

  // Fall through to index.html so the SPA can render. Unknown paths get the
  // same shell but with a 404 status, otherwise every mistyped URL is a
  // soft 404 that search engines index.
  app.use("*", (req, res) => {
    const requestPath = req.originalUrl.split("?")[0].replace(/\/+$/, "") || "/";
    const isKnown =
      !knownRoutes ||
      knownRoutes.exact.has(requestPath) ||
      knownRoutes.patterns.some((pattern) => pattern.test(requestPath));
    res.status(isKnown ? 200 : 404).sendFile(path.resolve(distPath, "index.html"));
  });
}
