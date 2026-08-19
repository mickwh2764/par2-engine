import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { INTERNAL_PAGES } from "../shared/internal-pages";

const publicDir = path.resolve(__dirname, "..", "client", "public");
const sitemap = fs.readFileSync(path.join(publicDir, "sitemap.xml"), "utf-8");
const locs = [...sitemap.matchAll(/<loc>https:\/\/par2discovery\.com([^<]*)<\/loc>/g)].map((m) => m[1]);

describe("sitemap.xml", () => {
  it("lists only pages the production server serves", () => {
    expect(locs.length).toBeGreaterThan(0);
    for (const internalPage of INTERNAL_PAGES) {
      expect(locs).not.toContain(internalPage);
    }
  });

  it("has no duplicate or dynamic URLs", () => {
    expect(new Set(locs).size).toBe(locs.length);
    expect(locs.filter((loc) => loc.includes(":"))).toEqual([]);
  });

  it("matches the route manifest the server uses for 404s", () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(publicDir, "routes.json"), "utf-8"));
    for (const loc of locs) {
      expect(manifest.routes).toContain(loc);
    }
  });
});
