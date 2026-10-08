/**
 * Integration tests for the saved-brief routes against local Supabase (skipped when it isn't running).
 * Rows are created through the API as the seeded recruiters, tagged with a run-unique TAG, and removed afterwards.
 */
import { createClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import type { Database } from '@/lib/database.types'
import { getSupabaseAdmin } from '@/server/supabase-admin'

import { DELETE as deleteBrief } from './[id]/route'
import { GET as listBriefs, POST as createBrief } from './route'

vi.mock('next/headers', () => ({
  cookies: async () => ({ getAll: () => [], set: () => {} }),
}))

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
const reachable =
  Boolean(URL && KEY && process.env.SUPABASE_SECRET_KEY) &&
  (await fetch(`${URL}/auth/v1/health`, { headers: { apikey: KEY! } }).then((r) => r.ok).catch(() => false))

const TAG = `test-saved-briefs-${Date.now()}`
const FILTERS = { seniority: ['senior'], open_to_work: true, years_experience: { min: 5 } }

async function tokenFor(email: string): Promise<string> {
  const client = createClient<Database>(URL!, KEY!, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data, error } = await client.auth.signInWithPassword({ email, password: 'rotto-assessment' })
  if (error || !data.session) throw new Error(`sign-in failed for ${email}: ${error?.message}`)
  return data.session.access_token
}

function req(path: string, token?: string, init: { method?: string; body?: unknown } = {}): Request {
  return new Request(`http://localhost${path}`, {
    method: init.method ?? 'GET',
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' },
    body: init.body === undefined ? undefined : typeof init.body === 'string' ? init.body : JSON.stringify(init.body),
  })
}

const api = {
  list: (token?: string) => listBriefs(req('/api/saved-briefs', token)),
  create: (token: string | undefined, body: unknown) =>
    createBrief(req('/api/saved-briefs', token, { method: 'POST', body })),
  remove: (token: string | undefined, id: string) =>
    deleteBrief(req(`/api/saved-briefs/${id}`, token, { method: 'DELETE' }), { params: Promise.resolve({ id }) }),
}

async function create(token: string, brief: string, filters: unknown = FILTERS): Promise<string> {
  const res = await api.create(token, { brief, filters })
  expect(res.status).toBe(201)
  const body = await res.json()
  expect(Object.keys(body)).toEqual(['id'])
  return body.id
}

describe.skipIf(!reachable)('/api/saved-briefs (local Supabase)', () => {
  let acme: string
  let globex: string

  beforeAll(async () => {
    ;[acme, globex] = await Promise.all([tokenFor('recruiter@acme.test'), tokenFor('recruiter@globex.test')])
  })

  afterAll(async () => {
    await getSupabaseAdmin().from('saved_briefs').delete().like('brief', `${TAG}%`)
  })

  it('saves (trimmed) and lists newest first with brief, filters and created_at', async () => {
    const first = await create(acme, `${TAG} first`)
    const second = await create(acme, `  ${TAG} second  `, {})

    const res = await api.list(acme)
    expect(res.status).toBe(200)
    const { saved_briefs } = await res.json()
    const mine = saved_briefs.filter((b: { brief: string }) => b.brief.startsWith(TAG))
    expect(mine.map((b: { id: string }) => b.id)).toEqual([second, first])
    expect(mine[0]).toEqual({ id: second, brief: `${TAG} second`, filters: {}, created_at: expect.any(String) })
    expect(mine[1].filters).toEqual(FILTERS)
  })

  it('validates brief (1–500 chars) and filters through the canonical filter schema', async () => {
    const bad = [
      { brief: '   ', filters: {} },
      { brief: 'x'.repeat(501), filters: {} },
      { brief: `${TAG} x` },
      { brief: `${TAG} x`, filters: { roles: ['Wizard'] } },
      { brief: `${TAG} x`, filters: { seniority: ['senior', 'senior'] } },
      { brief: `${TAG} x`, filters: { years_experience: { min: 9, max: 2 } } },
      { brief: `${TAG} x`, filters: { sql: "'; drop table candidates; --" } },
      { brief: `${TAG} x`, filters: [] },
      { brief: `${TAG} x`, filters: {}, company_id: 'globex' },
    ]
    for (const body of bad) expect((await api.create(acme, body)).status, JSON.stringify(body)).toBe(400)
    expect((await api.create(acme, 'not json')).status).toBe(400)
  })

  it('deletes; a repeat or malformed id is 404', async () => {
    const id = await create(acme, `${TAG} gone`)
    expect((await api.remove(acme, id)).status).toBe(204)
    expect((await api.remove(acme, id)).status).toBe(404)
    for (const bad of ['not-a-uuid', "1' or '1'='1", 'x'.repeat(500)]) {
      expect((await api.remove(acme, bad)).status).toBe(404)
    }
  })

  it("another company's saved search is invisible and 404 on delete", async () => {
    const id = await create(acme, `${TAG} private`)
    expect((await api.remove(globex, id)).status).toBe(404)
    expect(JSON.stringify(await (await api.list(globex)).json())).not.toContain(id)
    expect(JSON.stringify(await (await api.list(acme)).json())).toContain(id)
  })

  it('401 without a token or with an invalid one', async () => {
    const id = await create(acme, `${TAG} auth`)
    expect((await api.list()).status).toBe(401)
    expect((await api.create(undefined, { brief: 'x', filters: {} })).status).toBe(401)
    expect((await api.remove(undefined, id)).status).toBe(401)
    expect((await api.list('abc.def.ghi')).status).toBe(401)
  })
})
