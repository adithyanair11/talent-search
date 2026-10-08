import 'server-only'

import { PAID_STATUSES, planFrom, type PlanResponse } from '@/lib/plan'

import type { RequestContext } from './auth'

/**
 * The caller's plan. Both reads go through the caller's RLS client: recruiters can read their own
 * company row (for `searches_used`) and their own company's subscriptions, nothing else.
 */
export async function getPlan(ctx: RequestContext): Promise<PlanResponse> {
  const [company, paid] = await Promise.all([
    ctx.supabase.from('companies').select('searches_used').eq('id', ctx.companyId).single(),
    ctx.supabase
      .from('subscriptions')
      .select('stripe_subscription_id')
      .eq('company_id', ctx.companyId)
      .in('status', [...PAID_STATUSES])
      .limit(1),
  ])
  if (company.error) throw new Error(`plan: company read failed: ${company.error.message}`)
  if (paid.error) throw new Error(`plan: subscriptions read failed: ${paid.error.message}`)

  return planFrom(paid.data.length > 0, company.data.searches_used)
}
