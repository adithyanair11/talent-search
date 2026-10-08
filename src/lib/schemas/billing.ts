import { z } from 'zod'

/**
 * The fields of a Stripe event the webhook relies on. Everything else is passed to the DB function as-is
 * (it re-validates and reads `data.object` itself), so unknown event types never fail validation.
 */
export const stripeEventSchema = z
  .object({
    id: z.string().min(1).max(255),
    type: z.string().min(1).max(255),
    // Unix seconds. apply_stripe_event accepts at most 15 digits; anything longer is malformed (400 here), not a
    // 500 that Stripe would retry forever.
    created: z.number().int().nonnegative().max(999_999_999_999_999),
  })
  .loose()

export type StripeEvent = z.infer<typeof stripeEventSchema>

/** What `public.apply_stripe_event` did with an event. */
export type StripeEventResult = 'applied' | 'duplicate' | 'ignored' | 'stale'
