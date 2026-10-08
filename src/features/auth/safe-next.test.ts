import { describe, expect, it } from 'vitest'

import { safeNextPath } from './safe-next'

const ORIGIN = 'http://localhost:3000'

describe('safeNextPath', () => {
  it.each([
    ['/shortlists', '/shortlists'],
    ['/search?s=abc#top', '/search?s=abc#top'],
    ['/shortlists/123', '/shortlists/123'],
  ])('keeps same-origin path %s', (next, expected) => {
    expect(safeNextPath(next, ORIGIN)).toBe(expected)
  })

  it.each([
    null,
    '',
    'search',
    '//evil.example/x',
    '/\\evil.example/x',
    '/\t/evil.example/x',
    '/\n/evil.example/x',
    '/\r\n/evil.example',
    'https://evil.example',
    'javascript:alert(1)',
    '/%09/evil.example',
  ])('falls back for %j', (next) => {
    const out = safeNextPath(next, ORIGIN)
    expect(new URL(out, ORIGIN).origin).toBe(ORIGIN)
    if (next === null || !next.startsWith('/') || /^\/[\\/\t\n\r]/.test(next)) expect(out).toBe('/search')
  })
})
