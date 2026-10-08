import 'server-only'

/**
 * A small in-memory LRU cache with a per-entry TTL. Per server process (not shared across instances, gone on
 * restart). A Map keeps insertion order, so re-inserting on read makes the first key the least recently used.
 */
export class TtlLru<V> {
  private readonly entries = new Map<string, { value: V; expires: number }>()

  constructor(
    private readonly maxEntries: number,
    private readonly ttlMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  get(key: string): V | undefined {
    const entry = this.entries.get(key)
    if (!entry) return undefined
    this.entries.delete(key)
    if (entry.expires <= this.now()) return undefined
    this.entries.set(key, entry)
    return entry.value
  }

  set(key: string, value: V): void {
    this.entries.delete(key)
    this.entries.set(key, { value, expires: this.now() + this.ttlMs })
    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next().value
      if (oldest === undefined) break
      this.entries.delete(oldest)
    }
  }

  get size(): number {
    return this.entries.size
  }
}
