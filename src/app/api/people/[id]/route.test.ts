/**
 * Integration test for GET /api/people/{id} against local Supabase (skipped when it isn't running).
 * Candidates are shared across companies, so both seeded recruiters see the same record.
 */
import { createClient } from '@supabase/supabase-js'
import { beforeAll, describe, expect, it, vi } from 'vitest'

import type { Database } from '@/lib/database.types'
import { getSupabaseAdmin } from '@/server/supabase-admin'

import { GET } from './route'

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

function get(id: string, headers: Record<string, string> = {}) {
  return GET(new Request(`http://localhost/api/people/${encodeURIComponent(id)}`, { headers }), {
    params: Promise.resolve({ id }),
  })
}

describe.skipIf(!reachable)('GET /api/people/{id} (local Supabase)', () => {
  let acme: string
  let globex: string
  let id: string

  beforeAll(async () => {
    ;[acme, globex] = await Promise.all([tokenFor('recruiter@acme.test'), tokenFor('recruiter@globex.test')])
    // Pick a real candidate with several jobs rather than hardcoding an id.
    const { data } = await getSupabaseAdmin()
      .from('candidates')
      .select('id, experiences')
      .order('id')
      .limit(50)
    id = data!.find((c) => Array.isArray(c.experiences) && c.experiences.length > 1)!.id
  })

  it('returns the full candidate', async () => {
    const res = await get(id, { Authorization: `Bearer ${acme}` })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.id).toBe(id)
    expect(Object.keys(body).sort()).toEqual(
      [
        'avatar_url', 'current_company', 'current_company_logo_url', 'current_title', 'education', 'experiences',
        'full_name', 'headline', 'id', 'location', 'open_to_work', 'role', 'seniority', 'skills', 'years_experience',
      ].sort(),
    )
    expect(Object.keys(body.location).sort()).toEqual(['city', 'country', 'state'])
    expect(body.experiences.length).toBeGreaterThan(1)
    for (const e of body.experiences) {
      expect(e).toMatchObject({
        title: expect.any(String),
        company: expect.any(String),
        company_logo_url: expect.any(String),
        start_year: expect.any(Number),
        description: expect.any(String),
      })
    }
    expect(body.experiences[0].end_year).toBeNull()
    expect(body.education).toHaveLength(1)
    expect(body.education[0]).toMatchObject({ school: expect.any(String), graduation_year: expect.any(Number) })
    expect(Array.isArray(body.skills)).toBe(true)
  })

  it('is the same record for another company (candidates are shared)', async () => {
    const [a, g] = await Promise.all([
      get(id, { Authorization: `Bearer ${acme}` }).then((r) => r.json()),
      get(id, { Authorization: `Bearer ${globex}` }).then((r) => r.json()),
    ])
    expect(g).toEqual(a)
  })

  it('401 without a token or with an invalid one', async () => {
    expect((await get(id)).status).toBe(401)
    expect((await get(id, { Authorization: 'Bearer abc.def.ghi' })).status).toBe(401)
  })

  it('404 for an unknown id', async () => {
    const res = await get('cand_999999999', { Authorization: `Bearer ${acme}` })
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: { code: 'not_found', message: 'Candidate not found.' } })
  })

  it('404 for a malformed id, without touching the database', async () => {
    for (const bad of ["cand_1' or '1'='1", 'cand_', '../plan', 'x'.repeat(5000), '123']) {
      const res = await get(bad, { Authorization: `Bearer ${acme}` })
      expect(res.status).toBe(404)
      expect((await res.json()).error.code).toBe('not_found')
    }
  })
})
