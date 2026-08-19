import fs from "fs";
import os from "os";
import path from "path";
import { afterAll, describe, expect, it } from "vitest";
import { punctuationRedirectTarget, type RouteManifest } from "../static";

const distPath = fs.mkdtempSync(path.join(os.tmpdir(), "par2-static-"));
fs.writeFileSync(path.join(distPath, "publications.bib"), "@article{a}\n");

const knownRoutes: RouteManifest = {
  exact: new Set(["/", "/profile"]),
  patterns: [/^\/shared\/[^/]+$/],
};

const target = (url: string) => punctuationRedirectTarget(distPath, knownRoutes, url);

afterAll(() => fs.rmSync(distPath, { recursive: true, force: true }));

describe("punctuationRedirectTarget", () => {
  it("strips punctuation a prose citation appended to a static file", () => {
    expect(target("/publications.bib).")).toBe("/publications.bib");
    expect(target("/publications.bib,")).toBe("/publications.bib");
    expect(target("/publications.bib%29.")).toBe("/publications.bib");
  });

  it("strips punctuation from SPA routes and keeps the query string", () => {
    expect(target("/profile)")).toBe("/profile");
    expect(target("/shared/abc123).")).toBe("/shared/abc123");
    expect(target("/profile).?utm_source=bing")).toBe("/profile?utm_source=bing");
  });

  it("leaves clean URLs and unresolvable paths alone", () => {
    expect(target("/publications.bib")).toBeNull();
    expect(target("/profile")).toBeNull();
    expect(target("/nope).")).toBeNull();
    expect(target(").")).toBeNull();
  });

  it("does not escape the build directory", () => {
    expect(target("/../package.json).")).toBeNull();
    expect(target("/%2e%2e/package.json).")).toBeNull();
  });
});
