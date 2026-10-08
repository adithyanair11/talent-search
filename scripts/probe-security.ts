/**
 * Tenant-isolation probe. Signs in as the acme recruiter and tries to read and write globex data — directly
 * through supabase-js (PostgREST, RLS) and through the app's API routes when the dev server is running.
 * Every attack must fail or affect 0 rows; a few "control" cases check that acme's own legitimate access works.
 *
 * Fixtures: globex rows in recruiter-writable tables are created by the globex recruiter; rows in server-only
 * tables (searches, subscriptions, stripe_events) are created with the admin client, since no recruiter can
 * write them. All fixtures are removed at the end.
 *
 * Run with `npm run probe:security` (local Supabase must be running and seeded). Exits 1 on any failure.
 */
import './lib/env'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '../src/lib/database.types'
import { getSupabaseAdmin } from '../src/server/supabase-admin'
import { requireEnv } from './lib/env'

type Client = SupabaseClient<Database>
type Result = { data: unknown; error: { message: string } | null }

const URL = requireEnv('NEXT_PUBLIC_SUPABASE_URL')
const PUBLISHABLE_KEY = requireEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY')
const API_BASE = process.env.PROBE_BASE_URL ?? 'http://localhost:3000'
const PASSWORD = 'rotto-assessment'
const TAG = `probe-${Date.now()}`

const results: { status: 'PASS' | 'FAIL' | 'SKIP'; area: string; name: string; detail: string }[] = []

function record(ok: boolean | 'skip', area: string, name: string, detail: string): void {
  results.push({ status: ok === 'skip' ? 'SKIP' : ok ? 'PASS' : 'FAIL', area, name, detail })
}

function rows(data: unknown): unknown[] {
  if (Array.isArray(data)) return data
  return data == null ? [] : [data]
}

/** The attack must error or touch/return zero rows. */
async function blocked(area: string, name: string, query: PromiseLike<Result>): Promise<void> {
  const { data, error } = await query
  const n = rows(data).length
  if (error) record(true, area, name, `error: ${error.message}`)
  else record(n === 0, area, name, `${n} row(s)`)
}

/** Control: acme's own legitimate access must succeed. */
async function allowed(area: string, name: string, query: PromiseLike<Result>, minRows = 1): Promise<void> {
  const { data, error } = await query
  const n = rows(data).length
  if (error) record(false, area, name, `error: ${error.message}`)
  else record(n >= minRows, area, name, `${n} row(s)`)
}

function newClient(): Client {
  return createClient<Database>(URL, PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}

async function signIn(email: string): Promise<{ client: Client; token: string; userId: string }> {
  const client = newClient()
  const { data, error } = await client.auth.signInWithPassword({ email, password: PASSWORD })
  if (error || !data.session) throw new Error(`sign-in failed for ${email}: ${error?.message}`)
  return { client, token: data.session.access_token, userId: data.user.id }
}

function must<T>(step: string, res: { data: T; error: { message: string } | null }): NonNullable<T> {
  if (res.error || res.data == null) throw new Error(`${step}: ${res.error?.message ?? 'no data'}`)
  return res.data
}

async function main(): Promise<void> {
  const admin = getSupabaseAdmin()
  const acme = await signIn('recruiter@acme.test')
  const globex = await signIn('recruiter@globex.test')
  const anon = newClient()

  const acmeCompany = must('acme company', await acme.client.from('companies').select('*').single())
  const globexCompany = must('globex company', await globex.client.from('companies').select('*').single())

  // ---- Fixtures -------------------------------------------------------------------------------------
  const gShortlist = must(
    'globex shortlist',
    await globex.client.from('shortlists').insert({ name: `${TAG} globex` }).select().single(),
  )
  must(
    'globex shortlist person',
    await globex.client
      .from('shortlist_people')
      .insert({ shortlist_id: gShortlist.id, person_id: 'cand_0001' })
      .select()
      .single(),
  )
  const gBrief = must(
    'globex saved brief',
    await globex.client.from('saved_briefs').insert({ brief: `${TAG} globex`, filters: {} }).select().single(),
  )
  const gSearch = must(
    'globex search',
    await admin
      .from('searches')
      .insert({
        company_id: globexCompany.id,
        recruiter_id: globex.userId,
        brief: `${TAG} globex`,
        filters: {},
        result_ids: ['cand_0001'],
        total: 1,
      })
      .select()
      .single(),
  )
  const gSubId = `sub_${TAG}`
  must(
    'globex subscription',
    await admin
      .from('subscriptions')
      .insert({
        stripe_subscription_id: gSubId,
        company_id: globexCompany.id,
        status: 'incomplete',
        last_event_created: 1,
        last_event_id: `evt_${TAG}`,
      })
      .select()
      .single(),
  )
  const gEventId = `evt_${TAG}`
  must(
    'stripe event',
    await admin.from('stripe_events').insert({ event_id: gEventId, type: 'probe', created: 1 }).select().single(),
  )
  const aShortlist = must(
    'acme shortlist',
    await acme.client.from('shortlists').insert({ name: `${TAG} acme` }).select().single(),
  )

  try {
    const a = acme.client
    const G = globexCompany.id

    // ---- companies ----------------------------------------------------------------------------------
    {
      const { data, error } = await a.from('companies').select('id')
      const ids = (data ?? []).map((r) => r.id)
      record(!error && ids.length === 1 && ids[0] === acmeCompany.id, 'companies', 'select all → only own', `${ids.length} row(s)`)
    }
    await blocked('companies', 'select globex by id', a.from('companies').select().eq('id', G))
    await blocked('companies', 'update own searches_used', a.from('companies').update({ searches_used: 0 }).eq('id', acmeCompany.id).select())
    await blocked('companies', 'update globex', a.from('companies').update({ name: 'pwned' }).eq('id', G).select())
    await blocked('companies', 'insert', a.from('companies').insert({ slug: 'evil', name: 'Evil' }).select())
    await blocked('companies', 'delete globex', a.from('companies').delete().eq('id', G).select())

    // ---- recruiters ---------------------------------------------------------------------------------
    {
      const { data, error } = await a.from('recruiters').select('user_id')
      const ids = (data ?? []).map((r) => r.user_id)
      record(!error && ids.length === 1 && ids[0] === acme.userId, 'recruiters', 'select all → only self', `${ids.length} row(s)`)
    }
    await blocked('recruiters', 'select globex recruiter', a.from('recruiters').select().eq('user_id', globex.userId))
    await blocked('recruiters', 'move self to globex', a.from('recruiters').update({ company_id: G }).eq('user_id', acme.userId).select())
    await blocked('recruiters', 'insert self into globex', a.from('recruiters').insert({ user_id: acme.userId, company_id: G }).select())
    await blocked('recruiters', 'delete globex recruiter', a.from('recruiters').delete().eq('user_id', globex.userId).select())

    // ---- candidates (shared, read-only) -------------------------------------------------------------
    {
      const { count, error } = await a.from('candidates').select('id', { count: 'exact', head: true })
      record(!error && (count ?? 0) > 0, 'candidates', 'control: select (shared)', `${count} row(s)`)
    }
    await blocked('candidates', 'update', a.from('candidates').update({ full_name: 'pwned' }).eq('id', 'cand_0001').select())
    await blocked('candidates', 'delete', a.from('candidates').delete().eq('id', 'cand_0001').select())
    await blocked(
      'candidates',
      'insert',
      a.from('candidates').insert({
        id: 'cand_9999', full_name: 'x', avatar_url: 'x', headline: 'x', current_title: 'x', current_company: 'x',
        current_company_logo_url: 'x', role: 'x', seniority: 'mid', years_experience: 1, city: 'x', state: 'x',
        country: 'x', open_to_work: true,
      }).select(),
    )

    // ---- searches -----------------------------------------------------------------------------------
    await blocked('searches', 'select globex by id', a.from('searches').select().eq('id', gSearch.id))
    await blocked('searches', 'select by globex company_id', a.from('searches').select().eq('company_id', G))
    await blocked('searches', 'update globex', a.from('searches').update({ result_ids: [] }).eq('id', gSearch.id).select())
    await blocked('searches', 'delete globex', a.from('searches').delete().eq('id', gSearch.id).select())
    await blocked(
      'searches',
      'insert own (bypass quota)',
      a.from('searches').insert({ company_id: acmeCompany.id, brief: 'x', filters: {}, result_ids: [], total: 0 }).select(),
    )

    // ---- subscriptions ------------------------------------------------------------------------------
    await blocked('subscriptions', 'select globex', a.from('subscriptions').select().eq('stripe_subscription_id', gSubId))
    await blocked('subscriptions', 'select by globex company_id', a.from('subscriptions').select().eq('company_id', G))
    await blocked(
      'subscriptions',
      'insert own active (self-upgrade)',
      a.from('subscriptions').insert({
        stripe_subscription_id: `sub_${TAG}_acme`, company_id: acmeCompany.id, status: 'active',
        last_event_created: 1, last_event_id: 'x',
      }).select(),
    )
    await blocked('subscriptions', 'update globex', a.from('subscriptions').update({ status: 'canceled' }).eq('stripe_subscription_id', gSubId).select())
    await blocked('subscriptions', 'delete globex', a.from('subscriptions').delete().eq('stripe_subscription_id', gSubId).select())

    // ---- stripe_events ------------------------------------------------------------------------------
    await blocked('stripe_events', 'select all', a.from('stripe_events').select())
    await blocked('stripe_events', 'insert', a.from('stripe_events').insert({ event_id: `evt_${TAG}_acme`, type: 'x', created: 1 }).select())
    await blocked('stripe_events', 'delete', a.from('stripe_events').delete().eq('event_id', gEventId).select())

    // ---- shortlists ---------------------------------------------------------------------------------
    await blocked('shortlists', 'select globex by id', a.from('shortlists').select().eq('id', gShortlist.id))
    await blocked('shortlists', 'select by globex company_id', a.from('shortlists').select().eq('company_id', G))
    await blocked('shortlists', 'insert with globex company_id', a.from('shortlists').insert({ name: `${TAG} x`, company_id: G }).select())
    await blocked('shortlists', 'rename globex', a.from('shortlists').update({ name: 'pwned' }).eq('id', gShortlist.id).select())
    await blocked('shortlists', 'delete globex', a.from('shortlists').delete().eq('id', gShortlist.id).select())
    await blocked('shortlists', 'move own to globex', a.from('shortlists').update({ company_id: G }).eq('id', aShortlist.id).select())
    await allowed('shortlists', 'control: rename own', a.from('shortlists').update({ name: `${TAG} acme 2` }).eq('id', aShortlist.id).select())

    // ---- shortlist_people ---------------------------------------------------------------------------
    await blocked('shortlist_people', 'select globex list', a.from('shortlist_people').select().eq('shortlist_id', gShortlist.id))
    await blocked('shortlist_people', 'add to globex list', a.from('shortlist_people').insert({ shortlist_id: gShortlist.id, person_id: 'cand_0002' }).select())
    await blocked(
      'shortlist_people',
      'add to globex list with globex company_id',
      a.from('shortlist_people').insert({ shortlist_id: gShortlist.id, person_id: 'cand_0002', company_id: G }).select(),
    )
    await blocked(
      'shortlist_people',
      'add to own list with globex company_id',
      a.from('shortlist_people').insert({ shortlist_id: aShortlist.id, person_id: 'cand_0002', company_id: G }).select(),
    )
    await blocked('shortlist_people', 'remove from globex list', a.from('shortlist_people').delete().eq('shortlist_id', gShortlist.id).select())
    await allowed('shortlist_people', 'control: add to own list', a.from('shortlist_people').insert({ shortlist_id: aShortlist.id, person_id: 'cand_0002' }).select())
    await blocked(
      'shortlist_people',
      'move own row to globex',
      a.from('shortlist_people').update({ company_id: G }).eq('shortlist_id', aShortlist.id).select(),
    )

    // ---- saved_briefs -------------------------------------------------------------------------------
    await blocked('saved_briefs', 'select globex by id', a.from('saved_briefs').select().eq('id', gBrief.id))
    await blocked('saved_briefs', 'insert with globex company_id', a.from('saved_briefs').insert({ brief: 'x', filters: {}, company_id: G }).select())
    await blocked('saved_briefs', 'update globex', a.from('saved_briefs').update({ brief: 'pwned' }).eq('id', gBrief.id).select())
    await blocked('saved_briefs', 'delete globex', a.from('saved_briefs').delete().eq('id', gBrief.id).select())

    // ---- private functions are not exposed ----------------------------------------------------------
    await blocked('rpc', 'current_company_id', a.rpc('current_company_id' as never))
    await blocked('rpc', 'company_is_paid(globex)', a.rpc('company_is_paid' as never, { p_company_id: G } as never))
    await blocked('rpc', 'private schema table access', a.schema('private' as never).from('recruiters' as never).select())

    // ---- anon (no token) ----------------------------------------------------------------------------
    for (const table of [
      'companies', 'recruiters', 'candidates', 'searches', 'shortlists', 'shortlist_people', 'saved_briefs',
      'subscriptions', 'stripe_events',
    ] as const) {
      await blocked('anon', `select ${table}`, anon.from(table).select())
    }

    // ---- search functions ---------------------------------------------------------------------------
    await blocked('rpc', 'search_page(globex search)', a.rpc('search_page', { p_search_id: gSearch.id, p_page: 1 }))
    await blocked('rpc', 'anon run_search', anon.rpc('run_search', { p_brief: 'x', p_filters: { roles: ['Recruiter'] } }))
    await blocked('rpc', 'anon search_page(globex search)', anon.rpc('search_page', { p_search_id: gSearch.id, p_page: 1 }))
    await blocked('rpc', 'jsonb_text_array (private helper)', a.rpc('jsonb_text_array' as never, { arr: [] } as never))

    // ---- API routes (skipped when the dev server or route isn't there yet) -------------------------
    await probeApi(acme.token, {
      shortlistId: gShortlist.id,
      shortlistName: gShortlist.name,
      ownShortlistId: aShortlist.id,
      searchId: gSearch.id,
      briefId: gBrief.id,
    })

    // ---- globex fixtures and counters unchanged -----------------------------------------------------
    const after = {
      shortlist: (await globex.client.from('shortlists').select('name').eq('id', gShortlist.id).single()).data,
      people: (await globex.client.from('shortlist_people').select('person_id').eq('shortlist_id', gShortlist.id)).data,
      brief: (await globex.client.from('saved_briefs').select('brief').eq('id', gBrief.id).single()).data,
      search: (await admin.from('searches').select('result_ids').eq('id', gSearch.id).single()).data,
      sub: (await admin.from('subscriptions').select('status').eq('stripe_subscription_id', gSubId).single()).data,
      event: (await admin.from('stripe_events').select('event_id').eq('event_id', gEventId).single()).data,
      companies: (await admin.from('companies').select('slug, name, searches_used').order('slug')).data,
      recruiters: (await admin.from('recruiters').select('user_id, company_id')).data,
      candidate: (await admin.from('candidates').select('full_name').eq('id', 'cand_0001').single()).data,
    }
    const intact =
      after.shortlist?.name === gShortlist.name &&
      after.people?.length === 1 &&
      after.brief?.brief === gBrief.brief &&
      after.search?.result_ids.length === 1 &&
      after.sub?.status === 'incomplete' &&
      after.event?.event_id === gEventId &&
      JSON.stringify(after.companies) ===
        JSON.stringify([acmeCompany, globexCompany].map(({ slug, name, searches_used }) => ({ slug, name, searches_used })).sort((x, y) => x.slug.localeCompare(y.slug))) &&
      after.recruiters?.find((r) => r.user_id === acme.userId)?.company_id === acmeCompany.id &&
      after.candidate?.full_name !== 'pwned'
    record(intact, 'integrity', 'globex fixtures, companies, recruiters, candidates unchanged', intact ? 'ok' : JSON.stringify(after))
  } finally {
    await acme.client.from('shortlists').delete().eq('id', aShortlist.id)
    await globex.client.from('shortlists').delete().eq('id', gShortlist.id)
    await globex.client.from('saved_briefs').delete().eq('id', gBrief.id)
    await admin.from('searches').delete().eq('id', gSearch.id)
    await admin.from('subscriptions').delete().like('stripe_subscription_id', `sub_${TAG}%`)
    await admin.from('stripe_events').delete().like('event_id', `evt_${TAG}%`)
  }
}

type ApiCase = {
  name: string
  method: string
  path: string
  body?: unknown
  /** Passes when the response is OK and the body doesn't contain this (a list must hide the other company). */
  mustNotContain?: string
  /** Passes on exactly this status (controls and validation); default: 404 or 403. */
  expect?: number
}

async function probeApi(
  token: string,
  ids: { shortlistId: string; shortlistName: string; ownShortlistId: string; searchId: string; briefId: string },
): Promise<void> {
  const g = ids.shortlistId
  const cases: ApiCase[] = [
    { name: 'GET /api/shortlists hides globex', method: 'GET', path: '/api/shortlists', mustNotContain: g },
    { name: 'GET /api/shortlists hides globex names', method: 'GET', path: '/api/shortlists', mustNotContain: ids.shortlistName },
    { name: 'GET globex shortlist', method: 'GET', path: `/api/shortlists/${g}` },
    { name: 'PATCH globex shortlist', method: 'PATCH', path: `/api/shortlists/${g}`, body: { name: 'pwned' } },
    { name: 'DELETE globex shortlist', method: 'DELETE', path: `/api/shortlists/${g}` },
    { name: 'add person to globex shortlist', method: 'POST', path: `/api/shortlists/${g}/people/cand_0003` },
    { name: 'remove person from globex shortlist', method: 'DELETE', path: `/api/shortlists/${g}/people/cand_0001` },
    { name: 'shortlist id injection', method: 'GET', path: `/api/shortlists/${encodeURIComponent("1' or '1'='1")}` },
    {
      name: 'create shortlist with smuggled company_id',
      method: 'POST',
      path: '/api/shortlists',
      body: { name: `${TAG} smuggle`, company_id: 'globex' },
      expect: 400,
    },
    { name: 'control: GET own shortlist', method: 'GET', path: `/api/shortlists/${ids.ownShortlistId}`, expect: 200 },
    { name: 'GET /api/saved-briefs hides globex', method: 'GET', path: '/api/saved-briefs', mustNotContain: ids.briefId },
    { name: 'DELETE globex saved brief', method: 'DELETE', path: `/api/saved-briefs/${ids.briefId}` },
    { name: 'page globex search', method: 'GET', path: `/api/search/${ids.searchId}?page=1` },
  ]
  for (const c of cases) {
    let res: Response
    try {
      res = await fetch(API_BASE + c.path, {
        method: c.method,
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: c.body === undefined ? undefined : JSON.stringify(c.body),
        signal: AbortSignal.timeout(5000),
      })
    } catch {
      record('skip', 'api', c.name, `server not reachable at ${API_BASE}`)
      continue
    }
    // Next's own HTML 404 means the route doesn't exist yet. Any other non-JSON response (e.g. a 204 from a
    // DELETE that succeeded) is judged, so a successful cross-tenant write can never hide as a skip.
    const isJson = res.headers.get('content-type')?.includes('application/json') ?? false
    if (!isJson && res.status === 404) {
      record('skip', 'api', c.name, `route not implemented (${res.status})`)
      continue
    }
    const body = await res.text()
    if (c.mustNotContain) record(res.ok && !body.includes(c.mustNotContain), 'api', c.name, `${res.status}`)
    else if (c.expect !== undefined) record(res.status === c.expect, 'api', c.name, `${res.status}`)
    else record(res.status === 404 || res.status === 403, 'api', c.name, `${res.status}`)
  }
}

main()
  .catch((error: unknown) => {
    record(false, 'probe', 'crashed', error instanceof Error ? error.message : String(error))
  })
  .finally(() => {
    const width = Math.max(...results.map((r) => r.area.length))
    for (const r of results) console.log(`${r.status}  ${r.area.padEnd(width)}  ${r.name} — ${r.detail}`)
    const fails = results.filter((r) => r.status === 'FAIL').length
    const passes = results.filter((r) => r.status === 'PASS').length
    const skips = results.filter((r) => r.status === 'SKIP').length
    console.log(`\n${passes} passed, ${fails} failed, ${skips} skipped`)
    process.exit(fails > 0 ? 1 : 0)
  })
