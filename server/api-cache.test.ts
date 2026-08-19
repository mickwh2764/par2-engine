import { describe, it, expect, beforeEach, afterEach } from "vitest";
import express from "express";
import type { Server } from "http";
import { apiCache, __resetApiCache } from "./api-cache";

interface Harness {
  url: string;
  calls: () => number;
  close: () => Promise<void>;
}

function startServer(handler: express.RequestHandler): Promise<Harness> {
  let calls = 0;
  const app = express();
  app.use("/api", apiCache());
  app.get("/api/thing", (req, res, next) => {
    calls++;
    handler(req, res, next);
  });

  return new Promise((resolve) => {
    const server: Server = app.listen(0, () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      resolve({
        url: `http://127.0.0.1:${port}`,
        calls: () => calls,
        close: () => new Promise((done) => server.close(() => done())),
      });
    });
  });
}

describe("apiCache", () => {
  let harness: Harness | undefined;

  beforeEach(() => __resetApiCache());
  afterEach(async () => {
    await harness?.close();
    harness = undefined;
  });

  it("serves a repeated GET from cache without re-running the handler", async () => {
    harness = await startServer((_req, res) => res.json({ value: 1 }));

    const first = await fetch(`${harness.url}/api/thing`);
    const second = await fetch(`${harness.url}/api/thing`);

    expect(await first.json()).toEqual({ value: 1 });
    expect(await second.json()).toEqual({ value: 1 });
    expect(second.headers.get("x-cache")).toBe("HIT");
    expect(harness.calls()).toBe(1);
  });

  it("keys the cache on the query string", async () => {
    let n = 0;
    harness = await startServer((_req, res) => res.json({ n: ++n }));

    const a = await (await fetch(`${harness.url}/api/thing?gene=Per1`)).json();
    const b = await (await fetch(`${harness.url}/api/thing?gene=Arntl`)).json();

    expect(a).not.toEqual(b);
    expect(harness.calls()).toBe(2);
  });

  it("collapses concurrent identical requests into one computation", async () => {
    harness = await startServer((_req, res) => {
      setTimeout(() => res.json({ slow: true }), 150);
    });

    const responses = await Promise.all(
      Array.from({ length: 5 }, () => fetch(`${harness!.url}/api/thing`)),
    );

    for (const response of responses) {
      expect(await response.json()).toEqual({ slow: true });
    }
    expect(harness.calls()).toBe(1);
  });

  it("never caches a request that carries credentials", async () => {
    harness = await startServer((_req, res) => res.json({ private: true }));

    await fetch(`${harness.url}/api/thing`, { headers: { cookie: "session=abc" } });
    await fetch(`${harness.url}/api/thing`, { headers: { cookie: "session=abc" } });

    expect(harness.calls()).toBe(2);
  });

  it("does not cache error responses", async () => {
    harness = await startServer((_req, res) => res.status(500).json({ error: "boom" }));

    const first = await fetch(`${harness.url}/api/thing`);
    const second = await fetch(`${harness.url}/api/thing`);

    expect(first.status).toBe(500);
    expect(second.status).toBe(500);
    expect(harness.calls()).toBe(2);
  });
});
