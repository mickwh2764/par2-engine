import { describe, expect, it } from "vitest";
import { execSync } from "child_process";

// Copyright in Paper G (The Fibonacci Quarterly, doi:10.1080/00150517.2026.2716122) is assigned
// to The Fibonacci Association; its manuscripts must never be part of this public release.
const PAPER_G_MANUSCRIPT =
  /(whiteside_fq|reply_to_boman|paper_?g_?(fibonacci|condensed)|paper-g-fibonacci-reply)[^/]*\.(pdf|tex|docx?|zip)$|paper-g-fibonacci-reply\//i;

describe("Paper G manuscripts", () => {
  it("are not tracked in the public repository", () => {
    const tracked = execSync("git ls-files", { cwd: __dirname + "/..", encoding: "utf8" }).split("\n");
    expect(tracked.filter((f) => PAPER_G_MANUSCRIPT.test(f))).toEqual([]);
  });
});
