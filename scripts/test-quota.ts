/**
 * Free-plan race test. Puts acme on the free plan with 0 searches used, fires 25 concurrent POST /api/search with
 * its token and requires exactly 1 × 200 and 24 × 402. Then pages the successful search to the end (every id
 * exactly once, counter unchanged) and calls `run_search` directly through supabase-js, which must be rejected.
 *
 * Requests send recruiter-edited `filters`, so the race is on the database (no OpenAI dependency).
 * Run with `npm run test:quota` while `make dev` is running. Restores acme's state. Exits 1 on any failure.
 */
import './lib/env'

import { getSupabaseAdmin } from '../src/server/supabase-admin'
import { api, newClient, RECRUITER, requireServer, signIn, withCompanyState } from './lib/api'

const CONCURRENCY = 25
// Any constraint with several pages of results works; this is not a search-quality case.
const FILTERS = { roles: ['Backend Engineer'] }
const TAG = `quota-${Date.now()}`

type SearchBody = { search_id: string; total: number; results: { id: string }[]; searches_remaining: number | null }
type PageBody = { total: number; page: number; results: { id: string }[] }
type ErrorBody = { error: { code: string } }

let failures = 0
function check(ok: boolean, name: string, detail = ''): void {
  if (!ok) failures++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}

async function main(): Promise<void> {
  await requireServer()
  const admin = getSupabaseAdmin()
  const acme = await signIn(RECRUITER.acme)

  await withCompanyState('acme', 'free', TAG, async (company) => {
    const used = async () =>
      (await admin.from('companies').select('searches_used').eq('id', company.id).single()).data?.searches_used
    const searchCount = async () =>
      (await admin.from('searches').select('id', { count: 'exact', head: true }).eq('company_id', company.id)).count
    const countBefore = (await searchCount()) ?? 0

    const plan0 = await api<{ plan: string; searches_remaining: number | null }>(acme.token, 'GET', '/api/plan')
    check(plan0.body.plan === 'free' && plan0.body.searches_remaining === 1, 'starts free with 1 search', JSON.stringify(plan0.body))

    // ---- 25 concurrent searches -------------------------------------------------------------------------
    const responses = await Promise.all(
      Array.from({ length: CONCURRENCY }, (_, i) =>
        api<SearchBody | ErrorBody>(acme.token, 'POST', '/api/search', { brief: `${TAG} race ${i}`, filters: FILTERS }),
      ),
    )
    const ok = responses.filter((r) => r.status === 200)
    const paymentRequired = responses.filter(
      (r) => r.status === 402 && (r.body as ErrorBody).error?.code === 'payment_required',
    )
    const statuses = responses.reduce<Record<number, number>>(
      (acc, r) => ({ ...acc, [r.status]: (acc[r.status] ?? 0) + 1 }),
      {},
    )
    check(ok.length === 1, 'exactly one 200', JSON.stringify(statuses))
    check(paymentRequired.length === CONCURRENCY - 1, `exactly ${CONCURRENCY - 1} × 402 payment_required`, JSON.stringify(statuses))
    check((await used()) === 1, 'searches_used = 1')
    check((await searchCount()) === countBefore + 1, 'one search row stored')
    if (ok.length !== 1) return

    const search = ok[0].body as SearchBody
    check(search.searches_remaining === 0, 'response says 0 remaining')
    const plan1 = await api<{ searches_remaining: number | null }>(acme.token, 'GET', '/api/plan')
    check(plan1.body.searches_remaining === 0, 'GET /api/plan → 0 remaining')

    // ---- page the snapshot to the end -------------------------------------------------------------------
    const pages = Math.ceil(search.total / 20)
    const ids: string[] = []
    let pageErrors = 0
    for (let p = 1; p <= pages + 1; p++) {
      const res = await api<PageBody>(acme.token, 'GET', `/api/search/${search.search_id}?page=${p}`)
      if (res.status !== 200) pageErrors++
      else ids.push(...res.body.results.map((r) => r.id))
      if (p === pages + 1) check(res.status === 200 && res.body.results.length === 0, `page ${p} (past the end) is empty`)
    }
    check(pageErrors === 0, `${pages + 1} page requests all 200`)
    check(ids.length === search.total, `paged ${ids.length} ids = total ${search.total}`)
    check(new Set(ids).size === ids.length, 'every id exactly once')
    check(JSON.stringify(ids.slice(0, 20)) === JSON.stringify(search.results.map((r) => r.id)), 'page 1 = POST results')
    const plan2 = await api<{ searches_remaining: number | null }>(acme.token, 'GET', '/api/plan')
    check(plan2.body.searches_remaining === 0 && (await used()) === 1, 'paging consumed nothing (still 0 remaining)')

    // ---- direct RPC can't bypass the limit ----------------------------------------------------------------
    const direct = await acme.client.rpc('run_search', { p_brief: `${TAG} direct`, p_filters: FILTERS })
    check(direct.error?.code === 'PT402', 'direct supabase-js run_search → rejected (PT402)', direct.error?.message ?? 'no error')
    const anon = await newClient().rpc('run_search', { p_brief: `${TAG} anon`, p_filters: FILTERS })
    check(anon.error !== null, 'anon run_search → rejected', anon.error?.message ?? 'no error')
    check(
      (await used()) === 1 && (await searchCount()) === countBefore + 1,
      'counter and search rows unchanged after direct calls',
    )
  })
}

main()
  .catch((error: unknown) => {
    failures++
    console.error('FAIL  crashed —', error instanceof Error ? error.message : error)
  })
  .finally(() => {
    console.log(failures === 0 ? '\n✔ quota holds' : `\n✖ ${failures} check(s) failed`)
    process.exit(failures === 0 ? 0 : 1)
  })
