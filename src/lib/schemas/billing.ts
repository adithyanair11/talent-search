import { z } from 'zod'

/**
 * The fields of a Stripe event the webhook relies on. Everything else is passed to the DB function as-is
 * (it re-validates and reads `data.object` itself), so unknown event types never fail validation.
 */
export const stripeEventSchema = z
  .object({
    id: z.string().min(1).max(255),
    type: z.string().min(1).max(255),
    created: z.number().int().nonnegative(),
  })
  .loose()

export type StripeEvent = z.infer<typeof stripeEventSchema>

/** What `public.apply_stripe_event` did with an event. */
export type StripeEventResult = 'applied' | 'duplicate' | 'ignored' | 'stale'
