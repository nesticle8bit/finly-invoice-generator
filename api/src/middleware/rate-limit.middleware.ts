import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';

interface Bucket {
  count: number;
  resetAt: number;
}

interface RateLimitOptions {
  windowMs: number;
  max: number;
  /** Builds the bucket key. Defaults to the caller IP. */
  keyBuilder?: (req: Request) => string;
  message?: string;
}

/**
 * Fixed-window, in-memory rate limiter. Enough for a single-process API;
 * swap for a Redis-backed limiter if the API is ever scaled horizontally.
 */
export function rateLimit(options: RateLimitOptions) {
  const { windowMs, max, keyBuilder, message } = options;
  const buckets = new Map<string, Bucket>();

  // Drop expired buckets periodically so the map does not grow unbounded.
  const sweeper = setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(key);
    }
  }, windowMs);
  sweeper.unref?.();

  return (req: Request, res: Response, next: NextFunction): void => {
    // Tests hammer these endpoints from a single IP by design.
    if (env.isTest) {
      next();
      return;
    }

    const key = keyBuilder ? keyBuilder(req) : req.ip ?? 'unknown';
    const now = Date.now();
    const bucket = buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }

    bucket.count += 1;
    if (bucket.count > max) {
      const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
      res.setHeader('Retry-After', String(retryAfter));
      res.status(429).json({
        error: message ?? 'Too many requests. Please try again later.',
        retry_after: retryAfter,
      });
      return;
    }

    next();
  };
}
