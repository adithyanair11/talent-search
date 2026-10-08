import { describe, expect, it } from 'vitest'

import { RateLimiter } from './rate-limit'

function clock(start = 0) {
  let t = start
  return { now: () => t, advance: (ms: number) => (t += ms) }
}

describe('RateLimiter', () => {
  it('allows a burst up to capacity, then reports seconds until the next token', () => {
    const c = clock()
    const limiter = new RateLimiter(3, 1, c.now)
    expect([limiter.take('a'), limiter.take('a'), limiter.take('a')]).toEqual([0, 0, 0])
    expect(limiter.take('a')).toBe(1)
  })

  it('refills over time, never above capacity', () => {
    const c = clock()
    const limiter = new RateLimiter(2, 0.5, c.now)
    limiter.take('a')
    limiter.take('a')
    expect(limiter.take('a')).toBe(2)
    c.advance(2000)
    expect(limiter.take('a')).toBe(0)
    expect(limiter.take('a')).toBeGreaterThan(0)
    c.advance(60_000)
    expect([limiter.take('a'), limiter.take('a')]).toEqual([0, 0])
    expect(limiter.take('a')).toBeGreaterThan(0)
  })

  it('denied attempts do not drain the bucket further', () => {
    const c = clock()
    const limiter = new RateLimiter(1, 1, c.now)
    limiter.take('a')
    for (let i = 0; i < 10; i++) limiter.take('a')
    c.advance(1000)
    expect(limiter.take('a')).toBe(0)
  })

  it('keeps keys independent', () => {
    const limiter = new RateLimiter(1, 1, clock().now)
    expect(limiter.take('acme')).toBe(0)
    expect(limiter.take('acme')).toBe(1)
    expect(limiter.take('globex')).toBe(0)
  })

  it('prunes buckets that are full again once the map grows past maxKeys', () => {
    const c = clock()
    const limiter = new RateLimiter(2, 1, c.now, 3)
    for (const k of ['a', 'b', 'c']) limiter.take(k)
    c.advance(5000)
    limiter.take('d')
    expect(limiter.size).toBe(1)
  })

  it('reset() clears every bucket', () => {
    const limiter = new RateLimiter(1, 1, clock().now)
    limiter.take('a')
    limiter.reset()
    expect(limiter.take('a')).toBe(0)
  })
})
