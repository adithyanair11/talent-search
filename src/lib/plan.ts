/** Plan rules shared by the server (plan service) and the UI. See docs/decisions.md. */

/** Searches a company on the free plan may run, in total. */
export const FREE_SEARCH_LIMIT = 1

/** Subscription statuses that make a company paid. */
export const PAID_STATUSES = ['active', 'trialing'] as const

/** `GET /api/plan` response. `searches_remaining` is null on the paid plan (unlimited). */
export type PlanResponse = { plan: 'free' | 'paid'; searches_remaining: number | null }

export function planFrom(isPaid: boolean, searchesUsed: number): PlanResponse {
  if (isPaid) return { plan: 'paid', searches_remaining: null }
  return { plan: 'free', searches_remaining: Math.max(0, FREE_SEARCH_LIMIT - searchesUsed) }
}
