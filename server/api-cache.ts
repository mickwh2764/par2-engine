/**
 * Protection for the CPU-bound AR(2) analysis endpoints.
 *
 * The server is a single Node process and most /api GETs recompute a
 * deterministic analysis from static datasets, so a handful of simultaneous
 * visitors (or one crawler) can stall the whole site. Three cheap layers fix
 * that without changing any response body:
 *
 *   1. cache      — remember successful JSON responses for a while;
 *   2. single-flight — collapse concurrent requests for the same URL into one
 *                      computation, with the rest waiting on its result;
 *   3. gate       — cap how many uncached computations run at once, queueing
 *                   the overflow so latency degrades instead of the process.
 */
import type { Request, Response, NextFunction } from "express";

const TTL_MS = 15 * 60_000;
/** Skip caching responses big enough to blow up the heap (bytes of JSON). */
const MAX_ENTRY_BYTES = 4 * 1024 * 1024;
const MAX_TOTAL_BYTES = 128 * 1024 * 1024;

/** Concurrent uncached computations. Above this, requests queue. */
const MAX_CONCURRENT = 4;
/** How long a queued request waits for a slot before giving up. */
const MAX_QUEUE_WAIT_MS = 45_000;
/**
 * A handler that has not answered by now is assumed stuck; its slot is handed
 * back so one wedged endpoint cannot permanently shrink capacity.
 */
const SLOT_WATCHDOG_MS = 120_000;

interface CacheEntry {
  body: unknown;
  bytes: number;
  expires: number;
}

const cache = new Map<string, CacheEntry>();
let cachedBytes = 0;

/** Requests waiting for an identical in-flight request to publish its result. */
const inFlight = new Map<string, Array<(entry: CacheEntry | null) => void>>();

function evictExpired(now: number): void {
  cache.forEach((entry, key) => {
    if (entry.expires <= now) {
      cachedBytes -= entry.bytes;
      cache.delete(key);
    }
  });
}

function store(key: string, body: unknown): CacheEntry | null {
  let bytes: number;
  try {
    bytes = Buffer.byteLength(JSON.stringify(body));
  } catch {
    return null;
  }
  if (bytes > MAX_ENTRY_BYTES) return null;

  const now = Date.now();
  evictExpired(now);
  // Still over budget: drop oldest-inserted entries (Map preserves order).
  while (cachedBytes + bytes > MAX_TOTAL_BYTES && cache.size > 0) {
    const oldestKey = cache.keys().next().value as string;
    const oldest = cache.get(oldestKey)!;
    cachedBytes -= oldest.bytes;
    cache.delete(oldestKey);
  }

  const entry: CacheEntry = { body, bytes, expires: now + TTL_MS };
  cache.set(key, entry);
  cachedBytes += bytes;
  return entry;
}

function publish(key: string, entry: CacheEntry | null): void {
  const waiters = inFlight.get(key);
  inFlight.delete(key);
  waiters?.forEach((resolve) => resolve(entry));
}

/**
 * Cacheable = a plain read of public analysis data. Anything carrying
 * credentials is left alone so one visitor's response can never be replayed
 * to another.
 */
function isCacheable(req: Request): boolean {
  if (req.method !== "GET") return false;
  // File responses are I/O bound, often huge, and password-checked per request.
  const fullPath = `${req.baseUrl}${req.path}`;
  if (fullPath.startsWith("/api/download/") || fullPath.startsWith("/api/view/")) return false;
  if (req.headers.authorization || req.headers.cookie) return false;
  if (req.headers["x-download-password"]) return false;
  if ("password" in req.query) return false;
  return true;
}

let running = 0;
const queue: Array<() => void> = [];

function releaseSlot(): void {
  running--;
  const nextInQueue = queue.shift();
  if (nextInQueue) {
    running++;
    nextInQueue();
  }
}

function acquireSlot(): Promise<boolean> {
  if (running < MAX_CONCURRENT) {
    running++;
    return Promise.resolve(true);
  }
  return new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      const index = queue.indexOf(start);
      if (index !== -1) queue.splice(index, 1);
      resolve(false);
    }, MAX_QUEUE_WAIT_MS);

    function start() {
      if (settled) {
        // Slot handed to a request that already timed out — pass it on.
        releaseSlot();
        return;
      }
      settled = true;
      clearTimeout(timer);
      resolve(true);
    }

    queue.push(start);
  });
}

export function apiCache() {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!isCacheable(req)) {
      next();
      return;
    }

    const key = req.originalUrl;
    const cached = cache.get(key);
    if (cached && cached.expires > Date.now()) {
      res.setHeader("X-Cache", "HIT");
      res.json(cached.body);
      return;
    }

    const waiters = inFlight.get(key);
    if (waiters) {
      const entry = await new Promise<CacheEntry | null>((resolve) => {
        // Never wait on the leader forever: fall through and compute instead.
        const timer = setTimeout(() => resolve(null), SLOT_WATCHDOG_MS);
        timer.unref();
        waiters.push((result) => {
          clearTimeout(timer);
          resolve(result);
        });
      });
      if (entry) {
        res.setHeader("X-Cache", "HIT-COALESCED");
        res.json(entry.body);
        return;
      }
      // The leader failed or returned something uncacheable; compute our own.
    }

    const gotSlot = await acquireSlot();
    if (!gotSlot) {
      res.setHeader("Retry-After", "30");
      res.status(503).json({
        error: "Server busy running analyses. Please retry in a moment.",
      });
      return;
    }

    // Another request may have become the leader while we waited for a slot;
    // never replace its waiter list or those requests are stranded.
    if (!inFlight.has(key)) inFlight.set(key, []);
    let published = false;
    let slotHeld = true;
    const watchdog = setTimeout(() => {
      if (!slotHeld) return;
      slotHeld = false;
      releaseSlot();
    }, SLOT_WATCHDOG_MS);
    watchdog.unref();

    const finish = (entry: CacheEntry | null) => {
      if (published) return;
      published = true;
      clearTimeout(watchdog);
      if (slotHeld) {
        slotHeld = false;
        releaseSlot();
      }
      publish(key, entry);
    };

    const originalJson = res.json.bind(res);
    res.json = (body: unknown) => {
      if (res.statusCode === 200) {
        finish(store(key, body));
      } else {
        finish(null);
      }
      res.setHeader("X-Cache", "MISS");
      return originalJson(body);
    };
    // Non-JSON responses (files, zips, errors) and dropped connections must
    // still free the slot and release anyone waiting on us.
    res.on("close", () => finish(null));
    res.on("finish", () => finish(null));

    next();
  };
}

/** Exposed for tests. */
export function __resetApiCache(): void {
  cache.clear();
  cachedBytes = 0;
  inFlight.clear();
  queue.length = 0;
  running = 0;
}
