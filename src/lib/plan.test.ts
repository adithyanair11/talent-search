import { describe, expect, it } from 'vitest'

import { FREE_SEARCH_LIMIT, planFrom } from './plan'

describe('planFrom', () => {
  it('paid is unlimited', () => {
    expect(planFrom(true, 42)).toEqual({ plan: 'paid', searches_remaining: null })
  })

  it('free counts down from the limit and never goes negative', () => {
    expect(planFrom(false, 0)).toEqual({ plan: 'free', searches_remaining: FREE_SEARCH_LIMIT })
    expect(planFrom(false, FREE_SEARCH_LIMIT)).toEqual({ plan: 'free', searches_remaining: 0 })
    expect(planFrom(false, FREE_SEARCH_LIMIT + 3)).toEqual({ plan: 'free', searches_remaining: 0 })
  })
})
