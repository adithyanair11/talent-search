/**
 * Integration tests for POST /api/billing/events against local Supabase (skipped when it isn't running). Events
 * are signed here with a test secret; every subscription/event id is unique to this run and removed afterwards.
 * Subscriptions are created for globex only, which other test files already treat as paid, so they never race
 * the free-limit tests on acme.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { signStripePayload } from '@/server/billing/verify-signature'
import { getSupabaseAdmin } from '@/server/supabase-admin'

import { POST } from './route'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
const reachable =
  Boolean(URL && KEY && process.env.SUPABASE_SECRET_KEY) &&
  (await fetch(`${URL}/auth/v1/health`, { headers: { apikey: KEY! } }).then((r) => r.ok).catch(() => false))

const SECRET = 'whsec_route_test'
const TAG = `test-billing-${Date.now()}`
const SUB = `sub_${TAG}`

let seq = 0
function event(type: string, created: number, object: Record<string, unknown>, id = `evt_${TAG}_${++seq}`) {
  return { id, object: 'event', type, created, data: { object: { object: 'subscription', ...object } } }
}

function send(body: string, signature: string | null = `t=1791211200,v1=${signStripePayload(body, SECRET, 1791211200)}`) {
  return POST(
    new Request('http://localhost/api/billing/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(signature !== null && { 'Stripe-Signature': signature }) },
      body,
    }),
  )
}
const sendEvent = (e: unknown) => send(JSON.stringify(e))

describe.skipIf(!reachable)('POST /api/billing/events (local Supabase)', () => {
  const admin = getSupabaseAdmin()
  const sub = async (id = SUB) =>
    (await admin.from('subscriptions').select('status, last_event_id').eq('stripe_subscription_id', id).maybeSingle()).data

  beforeAll(() => {
    vi.stubEnv('STRIPE_WEBHOOK_SECRET', SECRET)
  })

  afterAll(async () => {
    vi.unstubAllEnvs()
    await admin.from('subscriptions').delete().like('stripe_subscription_id', `sub_${TAG}%`)
    await admin.from('stripe_events').delete().like('event_id', `evt_${TAG}%`)
  })

  it('400 on a missing, malformed or wrong signature, without storing anything', async () => {
    const e = event('customer.subscription.created', 100, { id: SUB, status: 'active', metadata: { company: 'globex' } })
    const body = JSON.stringify(e)
    for (const signature of [null, '', 'garbage', `t=1,v1=${signStripePayload(body, 'whsec_wrong', 1)}`]) {
      const res = await send(body, signature)
      expect(res.status).toBe(400)
      expect(await res.json()).toEqual({ error: { code: 'bad_request', message: expect.any(String) } })
    }
    // Tampered body with the original signature.
    const sig = `t=1,v1=${signStripePayload(body, SECRET, 1)}`
    expect((await send(body.replace('active', 'trialing'), sig)).status).toBe(400)
    expect(await sub()).toBeNull()
    expect((await admin.from('stripe_events').select('event_id').eq('event_id', e.id)).data).toEqual([])
  })

  it('400 on a signed body that is not a Stripe event', async () => {
    expect((await send('not json')).status).toBe(400)
    expect((await send('[]')).status).toBe(400)
    expect((await send(JSON.stringify({ id: `evt_${TAG}_x`, type: 'x' }))).status).toBe(400)
  })

  it('applies, dedupes and ignores stale events (by event.created, not arrival)', async () => {
    const newer = event('customer.subscription.updated', 200, { id: SUB, status: 'active', metadata: { company: 'globex' } })
    const older = event('customer.subscription.created', 150, { id: SUB, status: 'incomplete', metadata: { company: 'globex' } })

    let res = await sendEvent(newer)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ received: true, result: 'applied' })
    expect(await sub()).toEqual({ status: 'active', last_event_id: newer.id })

    res = await sendEvent(newer)
    expect(res.status).toBe(200)
    expect((await res.json()).result).toBe('duplicate')

    res = await sendEvent(older)
    expect(res.status).toBe(200)
    expect((await res.json()).result).toBe('stale')
    expect(await sub()).toEqual({ status: 'active', last_event_id: newer.id })
  })

  it('deleted → canceled is terminal; a resubscribe is a new subscription id', async () => {
    const del = event('customer.subscription.deleted', 300, { id: SUB, status: 'active', metadata: { company: 'globex' } })
    expect((await (await sendEvent(del)).json()).result).toBe('applied')
    expect((await sub())?.status).toBe('canceled')

    const late = event('customer.subscription.updated', 400, { id: SUB, status: 'active', metadata: { company: 'globex' } })
    expect((await (await sendEvent(late)).json()).result).toBe('stale')
    expect((await sub())?.status).toBe('canceled')

    const resub = event('customer.subscription.created', 500, { id: `${SUB}_2`, status: 'active', metadata: { company: 'globex' } })
    expect((await (await sendEvent(resub)).json()).result).toBe('applied')
    expect((await sub(`${SUB}_2`))?.status).toBe('active')
  })

  it('tie on created: canceled wins, otherwise the larger event id', async () => {
    const id = `${SUB}_tie`
    const a = event('customer.subscription.created', 600, { id, status: 'active', metadata: { company: 'globex' } }, `evt_${TAG}_tie_b`)
    const b = event('customer.subscription.updated', 600, { id, status: 'past_due', metadata: { company: 'globex' } }, `evt_${TAG}_tie_a`)
    const c = event('customer.subscription.deleted', 600, { id, status: 'active', metadata: { company: 'globex' } }, `evt_${TAG}_tie_0`)
    expect((await (await sendEvent(a)).json()).result).toBe('applied')
    expect((await (await sendEvent(b)).json()).result).toBe('stale') // smaller id loses the tie
    expect((await (await sendEvent(c)).json()).result).toBe('applied') // canceled wins regardless of id
    expect((await sub(id))?.status).toBe('canceled')
  })

  it('200 and ignored for unknown company, missing metadata, unknown status and non-subscription types', async () => {
    const cases = [
      event('customer.subscription.created', 700, { id: `${SUB}_u1`, status: 'active', metadata: { company: 'initech' } }),
      event('customer.subscription.created', 700, { id: `${SUB}_u2`, status: 'active' }),
      event('customer.subscription.created', 700, { id: `${SUB}_u3`, status: 'weird', metadata: { company: 'globex' } }),
      event('invoice.paid', 700, { id: `in_${TAG}`, metadata: { company: 'globex' } }),
    ]
    for (const e of cases) {
      const res = await sendEvent(e)
      expect(res.status).toBe(200)
      expect((await res.json()).result).toBe('ignored')
    }
    expect((await admin.from('subscriptions').select('stripe_subscription_id').like('stripe_subscription_id', `${SUB}_u%`)).data).toEqual([])
  })
})
