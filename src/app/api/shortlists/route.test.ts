/**
 * Integration tests for the shortlist routes against local Supabase (skipped when it isn't running).
 * Lists are created through the API as the seeded recruiters, named with a run-unique TAG, and removed afterwards.
 */
import { createClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import type { Database } from '@/lib/database.types'
import { getSupabaseAdmin } from '@/server/supabase-admin'

import { DELETE as deletePerson, POST as addPerson } from './[id]/people/[personId]/route'
import { DELETE as deleteList, GET as getList, PATCH as renameList } from './[id]/route'
import { GET as listLists, POST as createList } from './route'

vi.mock('next/headers', () => ({
  cookies: async () => ({ getAll: () => [], set: () => {} }),
}))

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
const reachable =
  Boolean(URL && KEY && process.env.SUPABASE_SECRET_KEY) &&
  (await fetch(`${URL}/auth/v1/health`, { headers: { apikey: KEY! } }).then((r) => r.ok).catch(() => false))

const TAG = `test-shortlists-${Date.now()}`

async function tokenFor(email: string): Promise<string> {
  const client = createClient<Database>(URL!, KEY!, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data, error } = await client.auth.signInWithPassword({ email, password: 'rotto-assessment' })
  if (error || !data.session) throw new Error(`sign-in failed for ${email}: ${error?.message}`)
  return data.session.access_token
}

const auth = (token?: string): Record<string, string> => (token ? { Authorization: `Bearer ${token}` } : {})

function req(path: string, token?: string, init: { method?: string; body?: unknown } = {}): Request {
  return new Request(`http://localhost${path}`, {
    method: init.method ?? 'GET',
    headers: { ...auth(token), 'Content-Type': 'application/json' },
    body: init.body === undefined ? undefined : typeof init.body === 'string' ? init.body : JSON.stringify(init.body),
  })
}

const api = {
  list: (token?: string) => listLists(req('/api/shortlists', token)),
  create: (token: string | undefined, body: unknown) => createList(req('/api/shortlists', token, { method: 'POST', body })),
  get: (token: string | undefined, id: string) =>
    getList(req(`/api/shortlists/${id}`, token), { params: Promise.resolve({ id }) }),
  rename: (token: string | undefined, id: string, body: unknown) =>
    renameList(req(`/api/shortlists/${id}`, token, { method: 'PATCH', body }), { params: Promise.resolve({ id }) }),
  remove: (token: string | undefined, id: string) =>
    deleteList(req(`/api/shortlists/${id}`, token, { method: 'DELETE' }), { params: Promise.resolve({ id }) }),
  add: (token: string | undefined, id: string, personId: string) =>
    addPerson(req(`/api/shortlists/${id}/people/${personId}`, token, { method: 'POST' }), {
      params: Promise.resolve({ id, personId }),
    }),
  drop: (token: string | undefined, id: string, personId: string) =>
    deletePerson(req(`/api/shortlists/${id}/people/${personId}`, token, { method: 'DELETE' }), {
      params: Promise.resolve({ id, personId }),
    }),
}

async function create(token: string, name: string): Promise<string> {
  const res = await api.create(token, { name })
  expect(res.status).toBe(201)
  const body = await res.json()
  expect(Object.keys(body)).toEqual(['id'])
  return body.id
}

describe.skipIf(!reachable)('/api/shortlists (local Supabase)', () => {
  let acme: string
  let globex: string
  let people: string[]

  beforeAll(async () => {
    ;[acme, globex] = await Promise.all([tokenFor('recruiter@acme.test'), tokenFor('recruiter@globex.test')])
    const { data } = await getSupabaseAdmin().from('candidates').select('id').order('id').limit(6)
    people = data!.map((c) => c.id)
  })

  afterAll(async () => {
    await getSupabaseAdmin().from('shortlists').delete().like('name', `${TAG}%`)
  })

  it('creates, lists with count / avatars / person_ids, and returns details', async () => {
    const id = await create(acme, `  ${TAG} frontend  `)
    for (const p of people) expect((await api.add(acme, id, p)).status).toBe(201)

    const listRes = await api.list(acme)
    expect(listRes.status).toBe(200)
    const { shortlists } = await listRes.json()
    const mine = shortlists.find((s: { id: string }) => s.id === id)
    expect(mine).toMatchObject({ name: `${TAG} frontend`, count: people.length })
    expect(mine.avatar_urls).toHaveLength(4)
    expect([...mine.person_ids].sort()).toEqual([...people].sort())

    const detailRes = await api.get(acme, id)
    expect(detailRes.status).toBe(200)
    const detail = await detailRes.json()
    expect(detail).toMatchObject({ id, name: `${TAG} frontend`, count: people.length })
    expect(detail.people[0]).toMatchObject({
      id: expect.any(String),
      full_name: expect.any(String),
      headline: expect.any(String),
      location: { city: expect.any(String) },
      added_at: expect.any(String),
    })
    // Most recently added first.
    expect(detail.people[0].id).toBe(people.at(-1))
  })

  it('validates names: trimmed, 1–60 characters, JSON body, no extra keys', async () => {
    expect((await api.create(acme, { name: '   ' })).status).toBe(400)
    expect((await api.create(acme, { name: 'x'.repeat(61) })).status).toBe(400)
    expect((await api.create(acme, {})).status).toBe(400)
    expect((await api.create(acme, { name: 'ok', company_id: 'x' })).status).toBe(400)
    expect((await api.create(acme, 'not json')).status).toBe(400)
    const id = await create(acme, `${TAG} ${'y'.repeat(60 - TAG.length - 1)}`)
    expect(id).toEqual(expect.any(String))
  })

  it('409 with a friendly message on a duplicate name (case-insensitive), on create and rename', async () => {
    await create(acme, `${TAG} Design`)
    const other = await create(acme, `${TAG} Other`)

    const dup = await api.create(acme, { name: `${TAG} design` })
    expect(dup.status).toBe(409)
    expect((await dup.json()).error).toEqual({
      code: 'conflict',
      message: `You already have a list called “${TAG} design”. Pick another name.`,
    })
    expect((await api.rename(acme, other, { name: `${TAG} DESIGN` })).status).toBe(409)

    // Another company may use the same name.
    expect((await api.create(globex, { name: `${TAG} Design` })).status).toBe(201)
  })

  it('renames and deletes', async () => {
    const id = await create(acme, `${TAG} old`)
    const res = await api.rename(acme, id, { name: `${TAG} new ` })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ id, name: `${TAG} new` })

    expect((await api.remove(acme, id)).status).toBe(204)
    expect((await api.get(acme, id)).status).toBe(404)
    expect((await api.remove(acme, id)).status).toBe(404)
  })

  it('adding is idempotent (201 then 200) and removing works, also when repeated', async () => {
    const id = await create(acme, `${TAG} idem`)
    const first = await api.add(acme, id, people[0])
    expect(first.status).toBe(201)
    expect(await first.json()).toEqual({ shortlist_id: id, person_id: people[0], added: true })
    const again = await api.add(acme, id, people[0])
    expect(again.status).toBe(200)
    expect((await again.json()).added).toBe(false)
    expect((await (await api.get(acme, id)).json()).count).toBe(1)

    expect((await api.drop(acme, id, people[0])).status).toBe(204)
    expect((await api.drop(acme, id, people[0])).status).toBe(204)
    expect((await (await api.get(acme, id)).json()).count).toBe(0)
  })

  it('404 for an unknown candidate or malformed ids', async () => {
    const id = await create(acme, `${TAG} ids`)
    expect((await api.add(acme, id, 'cand_999999999')).status).toBe(404)
    expect((await api.add(acme, id, "cand_1' or 1=1")).status).toBe(404)
    for (const bad of ['not-a-uuid', "1' or '1'='1", 'x'.repeat(500)]) {
      expect((await api.get(acme, bad)).status).toBe(404)
      expect((await api.rename(acme, bad, { name: 'x' })).status).toBe(404)
      expect((await api.add(acme, bad, people[0])).status).toBe(404)
    }
  })

  it("another company's list is 404 everywhere and invisible in its list", async () => {
    const id = await create(acme, `${TAG} private`)
    expect((await api.add(acme, id, people[0])).status).toBe(201)

    expect((await api.get(globex, id)).status).toBe(404)
    expect((await api.rename(globex, id, { name: 'pwned' })).status).toBe(404)
    expect((await api.remove(globex, id)).status).toBe(404)
    expect((await api.add(globex, id, people[1])).status).toBe(404)
    expect((await api.drop(globex, id, people[0])).status).toBe(404)
    expect(JSON.stringify(await (await api.list(globex)).json())).not.toContain(id)

    const still = await (await api.get(acme, id)).json()
    expect(still).toMatchObject({ name: `${TAG} private`, count: 1 })
  })

  it('401 without a token or with an invalid one', async () => {
    const id = await create(acme, `${TAG} auth`)
    expect((await api.list()).status).toBe(401)
    expect((await api.create(undefined, { name: 'x' })).status).toBe(401)
    expect((await api.get(undefined, id)).status).toBe(401)
    expect((await api.add('abc.def.ghi', id, people[0])).status).toBe(401)
    expect((await api.drop(undefined, id, people[0])).status).toBe(401)
  })
})
