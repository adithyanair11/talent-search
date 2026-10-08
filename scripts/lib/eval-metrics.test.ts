import { describe, expect, it } from 'vitest'

import { macroAverage, PAGE_SIZE, percentile, scoreQuery } from './eval-metrics'

describe('scoreQuery', () => {
  it('perfect match', () => {
    expect(scoreQuery(['a', 'b'], ['b', 'a'])).toEqual({ precision: 1, recall: 1, f1: 1, page1Precision: 1 })
  })

  it('partial overlap', () => {
    const s = scoreQuery(['a', 'b', 'x', 'y'], ['a', 'b', 'c'])
    expect(s.precision).toBe(0.5)
    expect(s.recall).toBeCloseTo(2 / 3)
    expect(s.f1).toBeCloseTo((2 * 0.5 * (2 / 3)) / (0.5 + 2 / 3))
    expect(s.page1Precision).toBe(0.5)
  })

  it('no results for a non-empty expected set scores 0', () => {
    expect(scoreQuery([], ['a'])).toEqual({ precision: 0, recall: 0, f1: 0, page1Precision: 0 })
  })

  it('empty expected: nothing returned is perfect, anything returned is 0', () => {
    expect(scoreQuery([], [])).toEqual({ precision: 1, recall: 1, f1: 1, page1Precision: 1 })
    expect(scoreQuery(['a'], [])).toEqual({ precision: 0, recall: 0, f1: 0, page1Precision: 0 })
  })

  it('page-1 precision looks only at the first page, in rank order', () => {
    const expected = Array.from({ length: PAGE_SIZE }, (_, i) => `e${i}`)
    const results = [...Array.from({ length: PAGE_SIZE }, (_, i) => `x${i}`), ...expected]
    const s = scoreQuery(results, expected)
    expect(s.recall).toBe(1)
    expect(s.page1Precision).toBe(0)
  })

  it('duplicate ids are counted once', () => {
    expect(scoreQuery(['a', 'a'], ['a']).precision).toBe(1)
  })
})

describe('macroAverage / percentile', () => {
  it('averages each metric', () => {
    const avg = macroAverage([
      { precision: 1, recall: 0, f1: 0, page1Precision: 1 },
      { precision: 0, recall: 1, f1: 1, page1Precision: 0 },
    ])
    expect(avg).toEqual({ precision: 0.5, recall: 0.5, f1: 0.5, page1Precision: 0.5 })
    expect(macroAverage([]).f1).toBe(0)
  })

  it('nearest-rank percentile', () => {
    expect(percentile([5, 1, 3, 2, 4], 50)).toBe(3)
    expect(percentile([5, 1, 3, 2, 4], 100)).toBe(5)
    expect(percentile([], 50)).toBe(0)
  })
})
