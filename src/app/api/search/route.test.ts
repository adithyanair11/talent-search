/**
 * Integration tests for POST /api/search and GET /api/search/{search_id} against local Supabase (skipped when it
 * isn't running). Every request sends `filters`, so no OpenAI call is made. Globex gets a fixture paid subscription;
 * acme's counter is set with the admin client to exercise the free limit. Counters, fixtures and the searches
 * created here are restored / removed afterwards.
 */
import { createClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import type { Database } from '@/lib/database.types'
import { getSupabaseAdmin } from '@/server/supabase-admin'

import { GET } from './[searchId]/route'
import { POST } from './route'

vi.mock('next/headers', () => ({
  cookies: async () => ({ getAll: () => [], set: () => {} }),
}))

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
const reachable =
  Boolean(URL && KEY && process.env.SUPABASE_SECRET_KEY) &&
  (await fetch(`${URL}/auth/v1/health`, { headers: { apikey: KEY! } }).then((r) => r.ok).catch(() => false))

const TAG = `test-search-${Date.now()}`
const BACKEND = { roles: ['Backend Engineer'] }

async function tokenFor(email: string): Promise<string> {
  const client = createClient<Database>(URL!, KEY!, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data, error } = await client.auth.signInWithPassword({ email, password: 'rotto-assessment' })
  if (error || !data.session) throw new Error(`sign-in failed for ${email}: ${error?.message}`)
  return data.session.access_token
}

function post(token: string | null, body: unknown) {
  return POST(
    new Request('http://localhost/api/search', {
      method: 'POST',
      headers: { ...(token && { Authorization: `Bearer ${token}` }), 'Content-Type': 'application/json' },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }),
  )
}

function page(token: string, searchId: string, query = '') {
  return GET(
    new Request(`http://localhost/api/search/${searchId}${query}`, { headers: { Authorization: `Bearer ${token}` } }),
    { params: Promise.resolve({ searchId }) },
  )
}

describe.skipIf(!reachable)('/api/search (local Supabase)', () => {
  const admin = getSupabaseAdmin()
  const fixtureSub = `sub_${TAG}`
  let acme: string
  let globex: string
  let acmeId: string
  let globexId: string
  let usedBefore: Record<string, number>

  const used = async (companyId: string) =>
    (await admin.from('companies').select('searches_used').eq('id', companyId).single()).data!.searches_used
  const setUsed = (companyId: string, n: number) =>
    admin.from('companies').update({ searches_used: n }).eq('id', companyId)

  beforeAll(async () => {
    ;[acme, globex] = await Promise.all([tokenFor('recruiter@acme.test'), tokenFor('recruiter@globex.test')])
    const { data: companies } = await admin.from('companies').select('id, slug, searches_used')
    acmeId = companies!.find((c) => c.slug === 'acme')!.id
    globexId = companies!.find((c) => c.slug === 'globex')!.id
    usedBefore = Object.fromEntries(companies!.map((c) => [c.id, c.searches_used]))
    const { error } = await admin.from('subscriptions').insert({
      stripe_subscription_id: fixtureSub,
      company_id: globexId,
      status: 'active',
      last_event_created: 0,
      last_event_id: `evt_${TAG}`,
    })
    if (error) throw new Error(error.message)
  })

  afterAll(async () => {
    await admin.from('subscriptions').delete().eq('stripe_subscription_id', fixtureSub)
    await admin.from('searches').delete().like('brief', `${TAG}%`)
    for (const [id, n] of Object.entries(usedBefore ?? {})) await setUsed(id, n)
  })

  it('401 without a token', async () => {
    const res = await post(null, { brief: `${TAG} x`, filters: BACKEND })
    expect(res.status).toBe(401)
  })

  it('400 for invalid bodies', async () => {
    for (const body of [
      'not json',
      {},
      { brief: '   ', filters: BACKEND },
      { brief: 'x'.repeat(501), filters: BACKEND },
      { brief: `${TAG} x`, filters: { roles: ['Wizard'] } },
      { brief: `${TAG} x`, filters: { roles: 'Backend Engineer' } },
      { brief: `${TAG} x`, filters: BACKEND, extra: true },
    ]) {
      const res = await post(globex, body)
      expect(res.status, JSON.stringify(body)).toBe(400)
      expect((await res.json()).error.code).toBe('bad_request')
    }
  })

  it('returns the contract shape, best first, deterministic', async () => {
    const res = await post(globex, { brief: `${TAG} backend`, filters: BACKEND })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Object.keys(body).sort()).toEqual(['filters', 'results', 'search_id', 'searches_remaining', 'total'])
    expect(body.searches_remaining).toBeNull()
    expect(body.filters.roles).toEqual(['Backend Engineer'])
    expect(body.total).toBeGreaterThan(20)
    expect(body.results).toHaveLength(20)
    expect(body.results[0]).toMatchObject({ id: expect.stringMatching(/^cand_\d+$/), headline: expect.any(String) })

    const again = await (await post(globex, { brief: `${TAG} backend again`, filters: BACKEND })).json()
    expect(again.results.map((r: { id: string }) => r.id)).toEqual(body.results.map((r: { id: string }) => r.id))
  })

  it('never returns everyone: no constraint or an unsupported requirement → 0 results', async () => {
    for (const filters of [{}, { ...BACKEND, unsupported: ['speaks Japanese'] }, { preferences: ['Go'] }]) {
      const body = await (await post(globex, { brief: `${TAG} none`, filters })).json()
      expect(body.total, JSON.stringify(filters)).toBe(0)
      expect(body.results).toEqual([])
    }
  })

  it('pages the snapshot: every id once, past the end empty, counter untouched', async () => {
    const first = await (await post(globex, { brief: `${TAG} paging`, filters: BACKEND })).json()
    const before = await used(globexId)
    const ids: string[] = []
    const pages = Math.ceil(first.total / 20)
    for (let p = 1; p <= pages + 1; p++) {
      const res = await page(globex, first.search_id, `?page=${p}`)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body).toMatchObject({ search_id: first.search_id, total: first.total, page: p })
      if (p > pages) expect(body.results).toEqual([])
      ids.push(...body.results.map((r: { id: string }) => r.id))
    }
    expect(ids).toHaveLength(first.total)
    expect(new Set(ids).size).toBe(first.total)
    expect(ids.slice(0, 20)).toEqual(first.results.map((r: { id: string }) => r.id))
    expect((await (await page(globex, first.search_id)).json()).page).toBe(1)
    expect(await used(globexId)).toBe(before)
  })

  it('400 for a bad page or id; 404 for another company or unknown search', async () => {
    const { search_id } = await (await post(globex, { brief: `${TAG} 404`, filters: BACKEND })).json()
    for (const q of ['?page=0', '?page=-1', '?page=abc', '?page=1.5', '?page=']) {
      expect((await page(globex, search_id, q)).status, q).toBe(400)
    }
    expect((await page(globex, 'not-a-uuid')).status).toBe(400)
    const other = await page(acme, search_id)
    expect(other.status).toBe(404)
    expect((await other.json()).error.code).toBe('not_found')
    expect((await page(globex, crypto.randomUUID())).status).toBe(404)
  })

  it('free plan: exactly one search, then 402 without consuming anything', async () => {
    await setUsed(acmeId, 0)
    const ok = await post(acme, { brief: `${TAG} free`, filters: BACKEND })
    expect(ok.status).toBe(200)
    expect((await ok.json()).searches_remaining).toBe(0)
    expect(await used(acmeId)).toBe(1)

    const blocked = await post(acme, { brief: `${TAG} free 2`, filters: BACKEND })
    expect(blocked.status).toBe(402)
    expect((await blocked.json()).error.code).toBe('payment_required')
    expect(await used(acmeId)).toBe(1)
  })
})
