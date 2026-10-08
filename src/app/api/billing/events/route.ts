import { HttpError } from '@/lib/http'
import { stripeEventSchema } from '@/lib/schemas/billing'
import { applyStripeEvent } from '@/server/billing/service'
import { verifyStripeSignature } from '@/server/billing/verify-signature'
import { handleRouteError } from '@/server/route-error'

// No `runtime`/`dynamic` exports: Next 16 rejects them with cacheComponents (see api/plan/route.ts). The default
// runtime is Node, which `node:crypto` needs. Excluded from proxy.ts, so no session work runs before this.

/**
 * `POST /api/billing/events` — Stripe webhook. No recruiter token: the `Stripe-Signature` HMAC over the raw body is
 * the authentication. 400 on a bad signature or body; 200 for everything else, including repeats and events that
 * are ignored (unknown type / company) or stale (older than the stored state). Logs never include the secret or
 * the payload, only the event id, type and outcome.
 */
export async function POST(req: Request): Promise<Response> {
  try {
    const rawBody = await req.text()
    const secret = process.env.STRIPE_WEBHOOK_SECRET
    if (!secret) {
      console.error('[billing] STRIPE_WEBHOOK_SECRET is not set')
      throw new HttpError('internal', 'Webhook is not configured.')
    }
    if (!verifyStripeSignature(rawBody, req.headers.get('stripe-signature'), secret)) {
      throw new HttpError('bad_request', 'Invalid Stripe signature.')
    }

    let json: unknown
    try {
      json = JSON.parse(rawBody)
    } catch {
      throw new HttpError('bad_request', 'Body must be a JSON Stripe event.')
    }
    const parsed = stripeEventSchema.safeParse(json)
    if (!parsed.success) throw new HttpError('bad_request', 'Body must be a Stripe event with id, type and created.')

    const result = await applyStripeEvent(parsed.data)
    console.info(`[billing] ${parsed.data.id} ${parsed.data.type} -> ${result}`)
    return Response.json({ received: true, result }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    return handleRouteError(err)
  }
}
