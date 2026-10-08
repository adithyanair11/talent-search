import { describe, expect, it } from 'vitest'

import { TtlLru } from './ttl-lru'

describe('TtlLru', () => {
  it('expires entries after the TTL', () => {
    let now = 0
    const cache = new TtlLru<string>(10, 1000, () => now)
    cache.set('a', 'A')
    now = 999
    expect(cache.get('a')).toBe('A')
    now = 2000
    expect(cache.get('a')).toBeUndefined()
    expect(cache.size).toBe(0)
  })

  it('evicts the least recently used entry when full', () => {
    const cache = new TtlLru<number>(2, 60_000)
    cache.set('a', 1)
    cache.set('b', 2)
    expect(cache.get('a')).toBe(1) // a is now the most recently used
    cache.set('c', 3)
    expect(cache.get('b')).toBeUndefined()
    expect(cache.get('a')).toBe(1)
    expect(cache.get('c')).toBe(3)
  })
})
