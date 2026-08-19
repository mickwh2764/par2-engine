/**
 * Security utilities: HTML escaping, rate limiting, CORS helpers.
 */
import type { Request, Response, NextFunction } from 'express';

// ────────────────────────────────────────────────────────────────────────────
// HTML escaping
// ────────────────────────────────────────────────────────────────────────────

const HTML_ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/**
 * Escape a string for safe inclusion in HTML content.
 * Prevents XSS when user-supplied values (gene names, dataset names, etc.)
 * are interpolated into HTML templates.
 */
export function escapeHtml(str: string | number | null | undefined): string {
  if (str == null) return '';
  return String(str).replace(/[&<>"']/g, (ch) => HTML_ESCAPE_MAP[ch] || ch);
}

// ────────────────────────────────────────────────────────────────────────────
// Rate limiting (in-memory, per-IP)
// ────────────────────────────────────────────────────────────────────────────

interface RateBucket {
  tokens: number;
  lastRefill: number;
}

interface RateLimitConfig {
  /** Max requests per window */
  maxRequests: number;
  /** Window size in milliseconds */
  windowMs: number;
  /** Message returned on 429 */
  message?: string;
}

/**
 * Create an Express middleware that rate-limits requests by client IP using
 * a simple token-bucket algorithm.
 *
 * Suitable for single-process deployments. For multi-process/multi-node
 * setups, use a Redis-backed limiter instead.
 */
export function rateLimit(config: RateLimitConfig) {
  const { maxRequests, windowMs, message } = config;
  const buckets = new Map<string, RateBucket>();

  // Periodically clean stale entries to prevent memory leaks
  const CLEANUP_INTERVAL = Math.max(windowMs * 2, 60_000);
  setInterval(() => {
    const cutoff = Date.now() - windowMs * 2;
    buckets.forEach((bucket, key) => {
      if (bucket.lastRefill < cutoff) buckets.delete(key);
    });
  }, CLEANUP_INTERVAL).unref();

  return (req: Request, res: Response, next: NextFunction) => {
    const key = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();

    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { tokens: maxRequests, lastRefill: now };
      buckets.set(key, bucket);
    }

    // Refill tokens proportional to elapsed time
    const elapsed = now - bucket.lastRefill;
    const refill = Math.floor((elapsed / windowMs) * maxRequests);
    if (refill > 0) {
      bucket.tokens = Math.min(maxRequests, bucket.tokens + refill);
      bucket.lastRefill = now;
    }

    if (bucket.tokens <= 0) {
      const retryAfter = Math.ceil(windowMs / 1000);
      res.set('Retry-After', String(retryAfter));
      res.status(429).json({
        error: message || 'Too many requests. Please try again later.',
        retryAfterSeconds: retryAfter,
      });
      return;
    }

    bucket.tokens--;
    next();
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Pre-built rate limiters for different route tiers
// ────────────────────────────────────────────────────────────────────────────

/** General API — 120 req / 60 s per IP */
export const apiLimiter = rateLimit({
  maxRequests: 120,
  windowMs: 60_000,
  message: 'API rate limit exceeded. Please wait a moment before retrying.',
});

/** Computationally expensive endpoints — 10 req / 60 s per IP */
export const heavyLimiter = rateLimit({
  maxRequests: 10,
  windowMs: 60_000,
  message: 'This endpoint is computationally expensive. Please wait before retrying.',
});

/** File upload — 20 uploads / 60 s per IP */
export const uploadLimiter = rateLimit({
  maxRequests: 20,
  windowMs: 60_000,
  message: 'Upload rate limit exceeded. Please wait before uploading again.',
});
