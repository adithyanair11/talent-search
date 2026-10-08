/**
 * Tenant-isolation probe. Signs in as the acme recruiter and tries to read and write globex data — directly
 * through supabase-js (PostgREST, RLS) and through the app's API routes when the dev server is running.
 * Every attack must fail or affect 0 rows; a few "control" cases check that acme's own legitimate access works.
 *
 * Fixtures: globex rows in recruiter-writable tables are created by the globex recruiter; rows in server-only
 * tables (searches, subscriptions, stripe_events) are created with the admin client, since no recruiter can
 * write them. All fixtures are removed at the end.
 *
 * Also: every table × verb with only the publishable key, run_search/search_page/apply_stripe_event called
 * directly, every API route without a usable identity, and before/after row counts of every table.
 *
 * Run with `npm run probe:security` (local Supabase must be running and seeded; `make dev` for the API checks).
 * Exits 1 on any failure.
 */
import './lib/env'

import { createClient } from '@supabase/supabase-js'

import type { Database } from '../src/lib/database.types'
import { getSupabaseAdmin } from '../src/server/supabase-admin'
import { API_BASE as APP_BASE, newClient, PASSWORD, signIn, withCompanyState } from './lib/api'
import { requireEnv } from './lib/env'

type Result = { data: unknown; error: { message: string; code?: string } | null }
type Table = keyof Database['public']['Tables']

const URL = requireEnv('NEXT_PUBLIC_SUPABASE_URL')
const PUBLISHABLE_KEY = requireEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY')
const API_BASE = process.env.PROBE_BASE_URL ?? APP_BASE
const TAG = `probe-${Date.now()}`

/** Every table in `public`, with the column that identifies a row (for update/delete probes). */
const TABLES: Record<Table, string> = {
  companies: 'id',
  recruiters: 'user_id',
  candidates: 'id',
  searches: 'id',
  shortlists: 'id',
  shortlist_people: 'shortlist_id',
  saved_briefs: 'id',
  subscriptions: 'stripe_subscription_id',
  stripe_events: 'event_id',
}

/** Internals that would show the caller how the server or database is built. */
const LEAKS = /"stack"|\bat [\w.<>]+ \(.*:\d+:\d+\)|SQLSTATE|syntax error|relation "|violates|PGRST\d|plpgsql|failed:/i

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

/** The call must be refused outright (an error), with one of the expected codes. */
async function refused(area: string, name: string, query: PromiseLike<Result>, codes: string[]): Promise<void> {
  const { error } = await query
  record(!!error && codes.includes(error.code ?? ''), area, name, error ? `${error.code}: ${error.message}` : 'no error')
}

/** Control: acme's own legitimate access must succeed. */
async function allowed(area: string, name: string, query: PromiseLike<Result>, minRows = 1): Promise<void> {
  const { data, error } = await query
  const n = rows(data).length
  if (error) record(false, area, name, `error: ${error.message}`)
  else record(n >= minRows, area, name, `${n} row(s)`)
}

async function tableCounts(admin: ReturnType<typeof getSupabaseAdmin>): Promise<Record<Table, number>> {
  const out = {} as Record<Table, number>
  for (const table of Object.keys(TABLES) as Table[]) {
    const { count, error } = await admin.from(table).select('*', { count: 'exact', head: true })
    if (error) throw new Error(`count ${table}: ${error.message}`)
    out[table] = count ?? 0
  }
  return out
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
  const aBrief = must(
    'acme saved brief',
    await acme.client.from('saved_briefs').insert({ brief: `${TAG} acme`, filters: {} }).select().single(),
  )
  const aSearch = must(
    'acme search',
    await admin
      .from('searches')
      .insert({
        company_id: acmeCompany.id,
        recruiter_id: acme.userId,
        brief: `${TAG} acme`,
        filters: {},
        result_ids: ['cand_0001', 'cand_0002'],
        total: 2,
      })
      .select()
      .single(),
  )
  // A real, signed-in Supabase user who is nobody's recruiter: must get nothing anywhere.
  const strayEmail = `${TAG}@stray.test`
  const created = await admin.auth.admin.createUser({ email: strayEmail, password: PASSWORD, email_confirm: true })
  if (created.error) throw new Error(`stray user: ${created.error.message}`)
  const stray = created.data
  const strayToken = (await signIn(strayEmail)).token
  const before = await tableCounts(admin)

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
    await blocked('searches', 'move own to globex', a.from('searches').update({ company_id: G }).eq('id', aSearch.id).select())
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
    await blocked('shortlist_people', 'delete globex rows by person_id', a.from('shortlist_people').delete().eq('person_id', 'cand_0001').neq('shortlist_id', aShortlist.id).select())
    await blocked('shortlist_people', 'delete by globex company_id', a.from('shortlist_people').delete().eq('company_id', G).select())
    // Membership oracle: an upsert into the globex list must answer the same whether or not the candidate is on
    // it. Before the (shortlist_id, company_id, person_id) key, a member got 201 and a non-member 409.
    for (const onConflict of ['shortlist_id,person_id', 'shortlist_id,company_id,person_id']) {
      const answer = async (personId: string) => {
        const res = await fetch(`${URL}/rest/v1/shortlist_people?on_conflict=${onConflict}`, {
          method: 'POST',
          headers: {
            apikey: PUBLISHABLE_KEY,
            Authorization: `Bearer ${acme.token}`,
            'Content-Type': 'application/json',
            Prefer: 'resolution=ignore-duplicates',
          },
          body: JSON.stringify({ shortlist_id: gShortlist.id, person_id: personId }),
        })
        const body = (await res.json().catch(() => null)) as { code?: string } | null
        return `${res.status} ${body?.code ?? ''}`.trim()
      }
      const member = await answer('cand_0001')
      const nonMember = await answer('cand_0004')
      record(
        member === nonMember && !member.startsWith('2'),
        'shortlist_people',
        `upsert oracle (on_conflict=${onConflict}) answers alike`,
        `member ${member} · non-member ${nonMember}`,
      )
    }
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
    await blocked('saved_briefs', 'move own to globex', a.from('saved_briefs').update({ company_id: G } as never).eq('id', aBrief.id).select())
    await allowed('saved_briefs', 'control: select own', a.from('saved_briefs').select().eq('id', aBrief.id))

    // ---- private functions are not exposed ----------------------------------------------------------
    // PGRST202 = no such function in the exposed schemas; PGRST106 = schema not exposed; 42501 = no privilege.
    const NOT_CALLABLE = ['PGRST202', 'PGRST106', '42501']
    await refused('rpc', 'current_company_id', a.rpc('current_company_id' as never), NOT_CALLABLE)
    await refused('rpc', 'company_is_paid(globex)', a.rpc('company_is_paid' as never, { p_company_id: G } as never), NOT_CALLABLE)
    await refused('rpc', 'private.current_company_id', a.schema('private' as never).rpc('current_company_id' as never), NOT_CALLABLE)
    await refused('rpc', 'private.company_is_paid(globex)', a.schema('private' as never).rpc('company_is_paid' as never, { p_company_id: G } as never), NOT_CALLABLE)
    await refused('rpc', 'private schema table access', a.schema('private' as never).from('recruiters' as never).select(), NOT_CALLABLE)

    // ---- anon (publishable key only, no user token): every table × every verb ---------------------------
    // Untyped: column names differ per table, which the typed builder can't express in one loop.
    const untypedAnon = createClient(URL, PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
    for (const [table, key] of Object.entries(TABLES) as [Table, string][]) {
      const t = untypedAnon.from(table)
      const row: Record<string, string> = { [key]: `${TAG}-anon` }
      await blocked('anon', `select ${table}`, t.select())
      await blocked('anon', `insert ${table}`, t.insert(row).select())
      await blocked('anon', `update ${table}`, t.update(row).not(key, 'is', null).select())
      await blocked('anon', `delete ${table}`, t.delete().not(key, 'is', null).select())
      // The same read without supabase-js: raw PostgREST with just the apikey header.
      const res = await fetch(`${URL}/rest/v1/${table}?select=*`, { headers: { apikey: PUBLISHABLE_KEY } })
      const body = await res.text()
      record(!res.ok || body.trim() === '[]', 'anon', `raw GET /rest/v1/${table}`, `${res.status} ${body.slice(0, 60)}`)
    }

    // ---- search functions ---------------------------------------------------------------------------
    await blocked('rpc', 'search_page(globex search)', a.rpc('search_page', { p_search_id: gSearch.id, p_page: 1 }))
    await blocked('rpc', 'search_page(globex search, page 2)', a.rpc('search_page', { p_search_id: gSearch.id, p_page: 2 }))
    await allowed('rpc', 'control: search_page(own search)', a.rpc('search_page', { p_search_id: aSearch.id, p_page: 1 }), 2)
    {
      const res = await fetch(`${URL}/rest/v1/rpc/run_search`, {
        method: 'POST',
        headers: { apikey: PUBLISHABLE_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_brief: 'x', p_filters: { roles: ['Recruiter'] } }),
      })
      record(!res.ok, 'rpc', 'raw anon POST /rest/v1/rpc/run_search', `${res.status}`)
    }
    await blocked('rpc', 'anon run_search', anon.rpc('run_search', { p_brief: 'x', p_filters: { roles: ['Recruiter'] } }))
    await blocked('rpc', 'anon search_page(globex search)', anon.rpc('search_page', { p_search_id: gSearch.id, p_page: 1 }))
    await blocked('rpc', 'jsonb_text_array (private helper)', a.rpc('jsonb_text_array' as never, { arr: [] } as never))

    // ---- run_search called directly (skips the route's LLM, zod and normalizer) ------------------------
    const candidateTotal = before.candidates
    await withCompanyState('acme', 'free', `${TAG}_free`, async ({ id }) => {
      await admin.from('companies').update({ searches_used: 1 }).eq('id', id)
      await refused(
        'run_search',
        'free plan, quota used → PT402',
        a.rpc('run_search', { p_brief: `${TAG} direct`, p_filters: { roles: ['Backend Engineer'] } }),
        ['PT402'],
      )
      const used = (await admin.from('companies').select('searches_used').eq('id', id).single()).data?.searches_used
      const made = (await admin.from('searches').select('id').eq('brief', `${TAG} direct`)).data?.length
      record(used === 1 && made === 0, 'run_search', 'refused call consumed nothing', `used=${used} searches=${made}`)
    })
    await withCompanyState('acme', 'paid', `${TAG}_paid`, async ({ id }) => {
      const hostile: [string, unknown][] = [
        ['no constraints', {}],
        ['only unsupported', { unsupported: ['speaks Klingon'] }],
        ['only preferences', { preferences: ['likes Go'] }],
        ['off-vocabulary role', { roles: ["' OR 1=1 --"] }],
        ['wrong types', { roles: 'Backend Engineer', years_experience: { min: '-5' }, open_to_work: 'yes' }],
        ['negative years', { years_experience: { min: -100 } }],
        ['inverted years', { years_experience: { min: 10, max: 2 } }],
        ['vacuous years (max = data maximum)', { years_experience: { max: 15 } }],
        ['vacuous years (huge max)', { years_experience: { max: 1000 } }],
        ['unknown keys only', { company_id: G, admin: true }],
        ['filters as array', [{ roles: ['Backend Engineer'] }]],
      ]
      for (const [label, filters] of hostile) {
        const { data, error } = await a.rpc('run_search', { p_brief: `${TAG} ${label}`, p_filters: filters as never })
        const total = (data as { total: number }[] | null)?.[0]?.total
        record(!!error || total === 0, 'run_search', `${label} → refused or 0 results`, error ? `${error.code}` : `total=${total}`)
      }
      const { data, error } = await a.rpc('run_search', {
        p_brief: `${TAG} smuggle`,
        p_filters: { roles: ['Backend Engineer'], company_id: G } as never,
      })
      const row = (data as { search_id: string; total: number }[] | null)?.[0]
      if (error || !row) {
        record(true, 'run_search', 'smuggled company_id → refused', `${error?.code ?? 'no row'}`)
      } else {
        const owner = (await admin.from('searches').select('company_id').eq('id', row.search_id).single()).data?.company_id
        record(owner === id && row.total < candidateTotal, 'run_search', 'smuggled company_id → stored as acme, bounded', `owner=${owner === id ? 'acme' : owner} total=${row.total}`)
      }
      // Size/shape limits (the API's zod schema doesn't protect direct RPC callers). Must be refused fast: before
      // the limits, 1500 preferences ran scoring into the 8 s statement timeout on every call.
      const limits: [string, unknown][] = [
        ['1500 preferences', { roles: ['Backend Engineer'], preferences: Array.from({ length: 1500 }, (_, i) => `p${i}`) }],
        ['21 skills', { skills_any: Array.from({ length: 21 }, (_, i) => `s${i}`) }],
        ['2 MB filters', { roles: ['Backend Engineer'], interpretation: 'z'.repeat(2_000_000) }],
        ['unknown key', { roles: ['Backend Engineer'], junk: 'x' }],
        ['301-char string', { roles: ['Backend Engineer'], unsupported: ['u'.repeat(301)] }],
        ['nested long string', { roles: ['Backend Engineer'], corrections: [{ from: 'a', to: 'b'.repeat(301) }] }],
      ]
      for (const [label, filters] of limits) {
        const started = performance.now()
        const { error } = await a.rpc('run_search', { p_brief: `${TAG} ${label}`, p_filters: filters as never })
        const ms = Math.round(performance.now() - started)
        record(error?.code === '22023' && ms < 2000, 'run_search', `${label} → 22023, fast`, `${error?.code ?? 'no error'} in ${ms} ms`)
      }
      await allowed(
        'run_search',
        'control: valid filters',
        a.rpc('run_search', { p_brief: `${TAG} control`, p_filters: { roles: ['Backend Engineer'] } }),
      )
    })

    // ---- billing: only the service role may apply Stripe events ---------------------------------------
    const forged = {
      id: `evt_${TAG}_forged`,
      type: 'customer.subscription.created',
      created: 9_999_999_999,
      data: { object: { id: `sub_${TAG}_forged`, status: 'active', metadata: { company: 'acme' } } },
    }
    await blocked('rpc', 'apply_stripe_event (recruiter)', a.rpc('apply_stripe_event', { event: forged }))
    await blocked('rpc', 'anon apply_stripe_event', anon.rpc('apply_stripe_event', { event: forged }))
    await blocked('rpc', 'private.apply_stripe_event', a.schema('private' as never).rpc('apply_stripe_event' as never, { event: forged } as never))
    const forgedSub = await admin.from('subscriptions').select('stripe_subscription_id').eq('stripe_subscription_id', `sub_${TAG}_forged`)
    const forgedEvent = await admin.from('stripe_events').select('event_id').eq('event_id', `evt_${TAG}_forged`)
    record(
      (forgedSub.data?.length ?? 1) === 0 && (forgedEvent.data?.length ?? 1) === 0,
      'rpc',
      'forged Stripe event left no subscription or event row',
      `${forgedSub.data?.length ?? '?'} sub, ${forgedEvent.data?.length ?? '?'} event`,
    )

    // ---- API routes (skipped when the dev server or route isn't there yet) -------------------------
    await probeApi(acme.token, {
      shortlistId: gShortlist.id,
      shortlistName: gShortlist.name,
      ownShortlistId: aShortlist.id,
      searchId: gSearch.id,
      briefId: gBrief.id,
    })
    await probeApiAuth({ ownShortlistId: aShortlist.id, ownBriefId: aBrief.id, ownSearchId: aSearch.id, strayToken })

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
    // Row counts of every table: unchanged except the one control insert (acme adds cand_0002 to its own list).
    const now = await tableCounts(admin)
    for (const table of Object.keys(TABLES) as Table[]) {
      const expected = before[table] + (table === 'shortlist_people' ? 1 : 0)
      record(now[table] === expected, 'integrity', `row count ${table}`, `${before[table]} → ${now[table]}`)
    }
  } finally {
    await acme.client.from('shortlists').delete().eq('id', aShortlist.id)
    await acme.client.from('saved_briefs').delete().eq('id', aBrief.id)
    await admin.from('searches').delete().eq('id', aSearch.id)
    await admin.auth.admin.deleteUser(stray.user.id)
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
    { name: 'saved brief id injection', method: 'DELETE', path: `/api/saved-briefs/${encodeURIComponent("1' or '1'='1")}` },
    {
      name: 'save brief with smuggled company_id',
      method: 'POST',
      path: '/api/saved-briefs',
      body: { brief: `${TAG} smuggle`, filters: {}, company_id: 'globex' },
      expect: 400,
    },
    {
      name: 'save brief with off-vocabulary filters',
      method: 'POST',
      path: '/api/saved-briefs',
      body: { brief: `${TAG} smuggle`, filters: { roles: ["x'); drop table candidates; --"] } },
      expect: 400,
    },
    { name: 'control: GET /api/saved-briefs', method: 'GET', path: '/api/saved-briefs', expect: 200 },
    { name: 'page globex search', method: 'GET', path: `/api/search/${ids.searchId}?page=1` },
    { name: 'page globex search, page 2', method: 'GET', path: `/api/search/${ids.searchId}?page=2` },
    { name: 'globex search, no page', method: 'GET', path: `/api/search/${ids.searchId}` },
    // A malformed id is answered like an unknown one (404) by design: see api/people/[id]/route.ts.
    { name: 'person id injection', method: 'GET', path: `/api/people/${encodeURIComponent("cand_0001' or '1'='1")}`, expect: 404 },
    { name: 'unknown person', method: 'GET', path: '/api/people/cand_999999', expect: 404 },
    { name: 'control: GET /api/people/cand_0001', method: 'GET', path: '/api/people/cand_0001', expect: 200 },
    { name: 'control: GET /api/plan', method: 'GET', path: '/api/plan', expect: 200 },
    {
      name: 'webhook without Stripe signature (recruiter token)',
      method: 'POST',
      path: '/api/billing/events',
      body: { id: `evt_${TAG}_api`, type: 'customer.subscription.created', created: 9_999_999_999, data: { object: { id: `sub_${TAG}_api`, status: 'active', metadata: { company: 'acme' } } } },
      expect: 400,
    },
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

/**
 * Every route and method without a usable identity: no token, the publishable key as a Bearer, junk tokens, and a
 * real signed-in user who isn't a recruiter. All must be a 401 JSON error, before any work and without internals.
 */
async function probeApiAuth(ids: { ownShortlistId: string; ownBriefId: string; ownSearchId: string; strayToken: string }): Promise<void> {
  const routes: [string, string, unknown?][] = [
    ['POST', '/api/search', { brief: `${TAG} unauth`, filters: { roles: ['Backend Engineer'] } }],
    ['GET', `/api/search/${ids.ownSearchId}?page=1`],
    ['GET', '/api/people/cand_0001'],
    ['GET', '/api/shortlists'],
    ['POST', '/api/shortlists', { name: `${TAG} unauth` }],
    ['GET', `/api/shortlists/${ids.ownShortlistId}`],
    ['PATCH', `/api/shortlists/${ids.ownShortlistId}`, { name: 'pwned' }],
    ['DELETE', `/api/shortlists/${ids.ownShortlistId}`],
    ['POST', `/api/shortlists/${ids.ownShortlistId}/people/cand_0003`],
    ['DELETE', `/api/shortlists/${ids.ownShortlistId}/people/cand_0002`],
    ['GET', '/api/saved-briefs'],
    ['POST', '/api/saved-briefs', { brief: `${TAG} unauth`, filters: {} }],
    ['DELETE', `/api/saved-briefs/${ids.ownBriefId}`],
    ['GET', '/api/plan'],
  ]
  const identities: [string, Record<string, string>][] = [
    ['no token', {}],
    ['publishable key as Bearer', { Authorization: `Bearer ${PUBLISHABLE_KEY}` }],
    ['junk JWT', { Authorization: 'Bearer abc.def.ghi' }],
    ['Basic auth', { Authorization: 'Basic YWRtaW46YWRtaW4=' }],
    ['user with no recruiter row', { Authorization: `Bearer ${ids.strayToken}` }],
  ]
  for (const [who, headers] of identities) {
    const failures: string[] = []
    for (const [method, path, body] of routes) {
      let res: Response
      try {
        res = await fetch(API_BASE + path, {
          method,
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: body === undefined ? undefined : JSON.stringify(body),
          redirect: 'manual',
          signal: AbortSignal.timeout(10_000),
        })
      } catch {
        record('skip', 'api-auth', who, `server not reachable at ${API_BASE}`)
        return
      }
      const text = await res.text()
      let code: unknown
      try {
        code = JSON.parse(text)?.error?.code
      } catch {
        code = undefined
      }
      if (res.status !== 401 || code !== 'unauthorized' || LEAKS.test(text)) failures.push(`${method} ${path} → ${res.status}`)
    }
    record(failures.length === 0, 'api-auth', `${who}: ${routes.length} routes → 401`, failures.join('; ') || 'all 401')
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
