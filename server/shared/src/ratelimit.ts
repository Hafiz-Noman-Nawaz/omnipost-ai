/**
 * Per-user token bucket for mutating endpoints (docs/05 §1.3).
 * In-memory for v1; swap for Redis later via the same interface.
 */

export interface RateLimiter {
  /** Consume one token for `key`. Returns false when the caller must back off. */
  take(key: string): boolean;
}

export interface TokenBucketOptions {
  /** Bucket capacity (burst size). */
  capacity: number;
  /** Refill rate in tokens per second. */
  refillPerSecond: number;
  now?: () => number;
}

export function createTokenBucket(opts: TokenBucketOptions): RateLimiter {
  const capacity = Math.max(1, Math.floor(opts.capacity));
  const refill = Math.max(0.001, opts.refillPerSecond);
  const now = opts.now ?? Date.now;
  const buckets = new Map<string, { tokens: number; last: number }>();

  return {
    take(key: string): boolean {
      const t = now();
      const b = buckets.get(key);
      if (!b) {
        buckets.set(key, { tokens: capacity - 1, last: t });
        return true;
      }
      const elapsed = Math.max(0, t - b.last) / 1000;
      b.tokens = Math.min(capacity, b.tokens + elapsed * refill);
      b.last = t;
      if (b.tokens >= 1) {
        b.tokens -= 1;
        return true;
      }
      return false;
    },
  };
}

/** Default limiter for auth mutations: 5 attempts per minute per key. */
export const defaultAuthLimiter = createTokenBucket({ capacity: 5, refillPerSecond: 1 / 12 });
