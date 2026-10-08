/**
 * Latency bench against the running app. Globex gets a fixture paid subscription for the run (restored after).
 *
 * - New search: POST /api/search with briefs from data/queries.json (the full LLM path). Target p95 < 3 s. Each
 *   brief gets a unique `(ref …)` suffix so the extraction cache can't answer it — this measures the LLM.
 * - Cached brief: the same briefs again, answered from the extraction cache (still a search: SQL runs).
 * - Paging: GET /api/search/{id}?page=N on random pages of a large snapshot. Target p95 < 300 ms.
 *
 * Warm-up requests are excluded. Numbers from `make dev` are pessimistic (dev compilation, no minification);
 * point API_BASE_URL at `next start` for production-like numbers. Exits 1 if a target is missed.
 * Run with `npm run bench` (`make dev` running with OPENAI_API_KEY set).
 */
import './lib/env'

import { readFileSync } from 'node:fs'
import path from 'node:path'

import { api, RECRUITER, requireServer, signIn, withCompanyState } from './lib/api'
import { percentile } from './lib/eval-metrics'

const SEARCH_RUNS = 10
const PAGE_RUNS = 200
const TARGET = { search: 3000, page: 300 }
const TAG = `bench-${Date.now()}`

type SearchBody = { search_id: string; total: number }

function report(name: string, ms: number[], target: number): boolean {
  const p50 = percentile(ms, 50)
  const p95 = percentile(ms, 95)
  const ok = p95 < target
  console.log(
    `${ok ? 'PASS' : 'FAIL'}  ${name.padEnd(12)} n=${String(ms.length).padStart(3)}  p50 ${String(p50).padStart(5)} ms  p95 ${String(p95).padStart(5)} ms  max ${String(percentile(ms, 100)).padStart(5)} ms  (target p95 < ${target} ms)`,
  )
  return ok
}

async function main(): Promise<void> {
  await requireServer()
  const globex = await signIn(RECRUITER.globex)
  const briefs = (
    JSON.parse(readFileSync(path.resolve(process.cwd(), 'data/queries.json'), 'utf8')) as { brief: string }[]
  ).map((q) => q.brief)

  const ok = await withCompanyState('globex', 'paid', TAG, async () => {
    // Snapshot to page through: large, so random pages span the whole array.
    const big = await api<SearchBody>(globex.token, 'POST', '/api/search', {
      brief: `${TAG} paging`,
      filters: { open_to_work: true },
    })
    if (big.status !== 200) throw new Error(`setup search failed: ${big.status} ${JSON.stringify(big.body)}`)
    const pages = Math.ceil(big.body.total / 20)

    // Warm-up (route compilation in dev, connection pools, LLM client).
    await api(globex.token, 'GET', `/api/search/${big.body.search_id}?page=1`)
    await api(globex.token, 'POST', '/api/search', { brief: briefs[0] })

    const unique = Array.from({ length: SEARCH_RUNS }, (_, i) => `${briefs[i % briefs.length]} (ref ${TAG}-${i})`)
    const timedSearches = async (list: string[]) => {
      const ms: number[] = []
      for (const brief of list) {
        const res = await api(globex.token, 'POST', '/api/search', { brief })
        if (res.status !== 200) throw new Error(`search failed: ${res.status} ${JSON.stringify(res.body)}`)
        ms.push(res.ms)
      }
      return ms
    }
    const search = await timedSearches(unique)
    const cached = await timedSearches(unique)

    const paging: number[] = []
    for (let i = 0; i < PAGE_RUNS; i++) {
      const p = 1 + Math.floor(Math.random() * pages)
      const res = await api(globex.token, 'GET', `/api/search/${big.body.search_id}?page=${p}`)
      if (res.status !== 200) throw new Error(`page failed: ${res.status}`)
      paging.push(res.ms)
    }

    console.log(`Bench against ${process.env.API_BASE_URL ?? 'http://localhost:3000'} · snapshot of ${big.body.total} (${pages} pages)\n`)
    const searchOk = report('new search', search, TARGET.search)
    const cachedOk = report('cached brief', cached, TARGET.search)
    const pageOk = report('paging', paging, TARGET.page)
    return searchOk && cachedOk && pageOk
  })
  process.exit(ok ? 0 : 1)
}

main().catch((error: unknown) => {
  console.error('✖ bench crashed:', error instanceof Error ? error.message : error)
  process.exit(1)
})
