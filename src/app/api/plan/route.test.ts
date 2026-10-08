/**
 * Integration test for GET /api/plan against local Supabase (skipped when it isn't running).
 * Uses the two seeded recruiters; a globex subscription fixture is created with the admin client and removed.
 */
import { createClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import type { Database } from '@/lib/database.types'
import { getSupabaseAdmin } from '@/server/supabase-admin'

import { GET } from './route'

// Outside a Next request there is no cookie store; an empty one means "no cookie session".
vi.mock('next/headers', () => ({
  cookies: async () => ({ getAll: () => [], set: () => {} }),
}))

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
const reachable =
  Boolean(URL && KEY && process.env.SUPABASE_SECRET_KEY) &&
  (await fetch(`${URL}/auth/v1/health`, { headers: { apikey: KEY! } }).then((r) => r.ok).catch(() => false))

async function tokenFor(email: string): Promise<string> {
  const client = createClient<Database>(URL!, KEY!, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data, error } = await client.auth.signInWithPassword({ email, password: 'rotto-assessment' })
  if (error || !data.session) throw new Error(`sign-in failed for ${email}: ${error?.message}`)
  return data.session.access_token
}

function get(headers: Record<string, string> = {}) {
  return GET(new Request('http://localhost/api/plan', { headers }))
}

describe.skipIf(!reachable)('GET /api/plan (local Supabase)', () => {
  const fixtureId = `sub_test_plan_${Date.now()}`
  let acme: string
  let globex: string

  beforeAll(async () => {
    ;[acme, globex] = await Promise.all([tokenFor('recruiter@acme.test'), tokenFor('recruiter@globex.test')])
  })

  afterAll(async () => {
    await getSupabaseAdmin().from('subscriptions').delete().eq('stripe_subscription_id', fixtureId)
  })

  it('returns the contract shape with a Bearer token', async () => {
    const res = await get({ Authorization: `Bearer ${acme}` })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Object.keys(body).sort()).toEqual(['plan', 'searches_remaining'])
    if (body.plan === 'free') expect(typeof body.searches_remaining).toBe('number')
    else expect(body.searches_remaining).toBeNull()
  })

  it('401 without a token or cookie session', async () => {
    const res = await get()
    expect(res.status).toBe(401)
    expect((await res.json()).error.code).toBe('unauthorized')
  })

  it('401 for a malformed header or an invalid token', async () => {
    expect((await get({ Authorization: 'Basic abc' })).status).toBe(401)
    expect((await get({ Authorization: 'Bearer not-a-jwt' })).status).toBe(401)
    expect((await get({ Authorization: 'Bearer abc.def.ghi' })).status).toBe(401)
    const tampered = acme.slice(0, -4) + (acme.endsWith('AAAA') ? 'BBBB' : 'AAAA')
    expect((await get({ Authorization: `Bearer ${tampered}` })).status).toBe(401)
  })

  it("reflects only the caller's own company's subscription", async () => {
    const admin = getSupabaseAdmin()
    const acmeBefore = await (await get({ Authorization: `Bearer ${acme}` })).json()

    const { data: company } = await admin.from('companies').select('id').eq('slug', 'globex').single()
    const { error } = await admin.from('subscriptions').insert({
      stripe_subscription_id: fixtureId,
      company_id: company!.id,
      status: 'active',
      last_event_created: 0,
      last_event_id: 'evt_test_plan',
    })
    expect(error).toBeNull()

    expect(await (await get({ Authorization: `Bearer ${globex}` })).json()).toEqual({
      plan: 'paid',
      searches_remaining: null,
    })
    // Globex becoming paid must not change what acme sees.
    expect(await (await get({ Authorization: `Bearer ${acme}` })).json()).toEqual(acmeBefore)
  })
})
