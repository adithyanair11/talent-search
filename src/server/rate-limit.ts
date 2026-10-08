import 'server-only'

/**
 * Per-key token buckets, in memory. Per server process (not shared across instances, gone on restart), which is
 * enough to stop one recruiter scripting LLM spend; the free-plan quota is enforced in SQL regardless.
 * See docs/decisions.md ("Security pass").
 */
export class RateLimiter {
  private readonly buckets = new Map<string, { tokens: number; at: number }>()

  constructor(
    private readonly capacity: number,
    private readonly refillPerSecond: number,
    private readonly now: () => number = Date.now,
    /** Buckets idle long enough to be full again are dropped once the map grows past this. */
    private readonly maxKeys = 10_000,
  ) {}

  /** Takes one token for `key`. Returns 0 when allowed, otherwise the whole seconds until a token is free. */
  take(key: string): number {
    const now = this.now()
    const bucket = this.buckets.get(key)
    const tokens = bucket
      ? Math.min(this.capacity, bucket.tokens + ((now - bucket.at) / 1000) * this.refillPerSecond)
      : this.capacity
    if (tokens < 1) {
      this.buckets.set(key, { tokens, at: now })
      return Math.max(1, Math.ceil((1 - tokens) / this.refillPerSecond))
    }
    this.buckets.set(key, { tokens: tokens - 1, at: now })
    if (this.buckets.size > this.maxKeys) this.prune(now)
    return 0
  }

  reset(): void {
    this.buckets.clear()
  }

  get size(): number {
    return this.buckets.size
  }

  private prune(now: number): void {
    const fullAfterMs = (this.capacity / this.refillPerSecond) * 1000
    for (const [key, bucket] of this.buckets) {
      if (now - bucket.at >= fullAfterMs) this.buckets.delete(key)
    }
  }
}

/** POST /api/search, per recruiter: a burst of 30, then 1 per second. Far above human use. */
export const SEARCH_RATE_CAPACITY = 30
export const SEARCH_RATE_REFILL_PER_SECOND = 1
export const searchRateLimiter = new RateLimiter(SEARCH_RATE_CAPACITY, SEARCH_RATE_REFILL_PER_SECOND)
