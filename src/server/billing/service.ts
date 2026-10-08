import 'server-only'

import type { Json } from '@/lib/database.types'
import type { StripeEvent, StripeEventResult } from '@/lib/schemas/billing'

import { getSupabaseAdmin } from '../supabase-admin'

const RESULTS: readonly StripeEventResult[] = ['applied', 'duplicate', 'ignored', 'stale']

/**
 * Applies one verified Stripe event in a single DB transaction (`public.apply_stripe_event`): dedupe on event id,
 * resolve the company from `data.object.metadata.company`, upsert the subscription only if the event is newer.
 * Service-role client: the webhook has no recruiter token, and the function is executable only by service_role.
 */
export async function applyStripeEvent(event: StripeEvent): Promise<StripeEventResult> {
  const { data, error } = await getSupabaseAdmin().rpc('apply_stripe_event', { event: event as unknown as Json })
  if (error) throw new Error(`apply_stripe_event failed: ${error.code} ${error.message}`)
  if (!RESULTS.includes(data as StripeEventResult)) throw new Error(`apply_stripe_event: unexpected result`)
  return data as StripeEventResult
}
