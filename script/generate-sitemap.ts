import path from "path";
import fs from "fs";
import { INTERNAL_PAGES } from "../shared/internal-pages";

const SITE_URL = "https://par2discovery.com";

const rootDir = path.resolve(import.meta.dirname, "..");
const appPath = path.join(rootDir, "client", "src", "App.tsx");
const publicDir = path.join(rootDir, "client", "public");
const sitemapPath = path.join(publicDir, "sitemap.xml");
const manifestPath = path.join(publicDir, "routes.json");

// Higher priority for the pages a first-time visitor should land on.
const PRIORITIES: Record<string, string> = {
  "/": "1.0",
  "/dashboard": "0.9",
  "/getting-started": "0.9",
  "/profile": "0.9",
  "/about": "0.8",
  "/profile": "0.8",
  "/manuscript": "0.8",
  "/discovery-engine": "0.8",
  "/core-evidence": "0.8",
};

function collectRoutes(appSource: string): {
  component: string[];
  redirect: string[];
  dynamic: string[];
} {
  // Only <Route path="..." component={X} /> entries are real pages; redirect
  // routes use a render-prop child and are listed separately.
  const declared = [...appSource.matchAll(/<Route\s+path="([^"]+)"/g)].map((m) => m[1]);
  const component = [...appSource.matchAll(/<Route\s+path="([^"]+)"\s+component=/g)].map((m) => m[1]);
  const redirect = [...appSource.matchAll(/<Route\s+path="([^"]+)"\s*>\s*\{\(\)\s*=>\s*<Redirect/g)].map(
    (m) => m[1],
  );
  const dedupe = (paths: string[], keepDynamic = false) =>
    [...new Set(paths.filter((p) => p.includes(":") === keepDynamic))].sort();
  return {
    component: dedupe(component),
    redirect: dedupe(redirect),
    dynamic: dedupe(declared, true),
  };
}

function priorityFor(route: string): string {
  return PRIORITIES[route] ?? "0.6";
}

const { component, redirect, dynamic } = collectRoutes(fs.readFileSync(appPath, "utf-8"));
const internal = new Set(INTERNAL_PAGES);

// Pages the production server refuses to serve must never be advertised.
const publicRoutes = component.filter((route) => !internal.has(route));
const excluded = component.filter((route) => internal.has(route));

const lastmod = new Date().toISOString().slice(0, 10);

const urls = publicRoutes
  .map(
    (route) =>
      `  <url>\n` +
      `    <loc>${SITE_URL}${route === "/" ? "/" : route}</loc>\n` +
      `    <lastmod>${lastmod}</lastmod>\n` +
      `    <priority>${priorityFor(route)}</priority>\n` +
      `  </url>`,
  )
  .join("\n");

fs.writeFileSync(
  sitemapPath,
  `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    `${urls}\n` +
    `</urlset>\n`,
);

// Every path the SPA can render, so the server can answer unknown URLs with a
// real 404 instead of a 200 that search engines index as a soft 404.
fs.writeFileSync(
  manifestPath,
  `${JSON.stringify({ routes: [...publicRoutes, ...redirect].sort(), patterns: dynamic }, null, 2)}\n`,
);

console.log(
  `Wrote ${publicRoutes.length} URLs to client/public/sitemap.xml ` +
    `(excluded ${excluded.length} internal, ${redirect.length} redirect routes)`,
);
