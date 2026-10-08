/**
 * Search accuracy eval — the source of truth for search quality (CLAUDE.md "Search rules" #7).
 *
 * For every brief in data/queries.json: run the search, collect every result id in rank order, and report
 * precision, recall, F1, page-1 precision and latency per query plus macro averages and the filters used.
 *
 * Backend: the real API. Signs in as the globex recruiter, gives globex a fixture paid subscription for the run
 * (restored afterwards, with its counter and the searches created), POSTs each brief to /api/search and pages
 * through GET /api/search/{id} to collect every result id. Needs `make dev` running (or API_BASE_URL).
 *
 * Run with `npm run eval` (local Supabase running + seeded, the app running with OPENAI_API_KEY set).
 * Exits 1 if any query errors.
 */
import './lib/env'

import { readFileSync } from 'node:fs'
import path from 'node:path'

import type { Filters } from '../src/lib/schemas/filters'
import { getModel } from '../src/server/llm/extract-filters'
import { api, API_BASE, RECRUITER, requireServer, signIn, withCompanyState } from './lib/api'
import { requireEnv } from './lib/env'
import { macroAverage, percentile, scoreQuery, type QueryScore } from './lib/eval-metrics'

interface Query {
  brief: string
  expected_ids: string[]
}

interface SearchRun {
  filters: Filters
  ids: string[]
  searchMs: number
  pagingMs: number
}

type SearchBody = { search_id: string; filters: Filters; total: number; results: { id: string }[] }
type PageBody = { results: { id: string }[] }

async function search(token: string, brief: string): Promise<SearchRun> {
  const first = await api<SearchBody>(token, 'POST', '/api/search', { brief })
  if (first.status !== 200) throw new Error(`POST /api/search → ${first.status} ${JSON.stringify(first.body)}`)
  const { search_id, filters, total, results } = first.body
  const ids = results.map((r) => r.id)
  const started = performance.now()
  for (let page = 2; ids.length < total; page++) {
    const res = await api<PageBody>(token, 'GET', `/api/search/${search_id}?page=${page}`)
    if (res.status !== 200) throw new Error(`GET page ${page} → ${res.status}`)
    if (res.body.results.length === 0) break
    ids.push(...res.body.results.map((r) => r.id))
  }
  return { filters, ids, searchMs: first.ms, pagingMs: Math.round(performance.now() - started) }
}

const fmt = (n: number) => n.toFixed(3)
const pad = (s: string | number, n: number) => String(s).padStart(n)

async function main(): Promise<void> {
  requireEnv('NEXT_PUBLIC_SUPABASE_URL')
  requireEnv('SUPABASE_SECRET_KEY')

  const queries = JSON.parse(
    readFileSync(path.resolve(process.cwd(), 'data/queries.json'), 'utf8'),
  ) as Query[]
  await requireServer()
  const globex = await signIn(RECRUITER.globex)
  console.log(`Search eval — ${queries.length} briefs · model ${getModel()} · API ${API_BASE}\n`)

  const scores: QueryScore[] = []
  const searchLatency: number[] = []
  const pagingLatency: number[] = []
  let failures = 0

  console.log(` #  ${pad('P', 6)} ${pad('R', 6)} ${pad('F1', 6)} ${pad('P@1', 6)} ${pad('got/exp', 9)} ${pad('POST ms', 7)} ${pad('pages', 6)}  brief`)
  const details: string[] = []

  await withCompanyState('globex', 'paid', `eval-${Date.now()}`, async () => {
  for (const [i, q] of queries.entries()) {
    const n = pad(i + 1, 2)
    try {
      const run = await search(globex.token, q.brief)
      const s = scoreQuery(run.ids, q.expected_ids)
      scores.push(s)
      searchLatency.push(run.searchMs)
      pagingLatency.push(run.pagingMs)
      console.log(
        `${n}  ${pad(fmt(s.precision), 6)} ${pad(fmt(s.recall), 6)} ${pad(fmt(s.f1), 6)} ${pad(fmt(s.page1Precision), 6)} ${pad(`${run.ids.length}/${q.expected_ids.length}`, 9)} ${pad(run.searchMs, 7)} ${pad(run.pagingMs, 6)}  ${q.brief}`,
      )
      details.push(`${n}  ${q.brief}\n    filters: ${JSON.stringify(run.filters)}`)
    } catch (error) {
      failures++
      scores.push({ precision: 0, recall: 0, f1: 0, page1Precision: 0 })
      const message = error instanceof Error ? error.message : String(error)
      console.log(`${n}  ERROR ${message}  ${q.brief}`)
    }
  }
  })

  const avg = macroAverage(scores)
  console.log(
    `\nMacro   P ${fmt(avg.precision)}  R ${fmt(avg.recall)}  F1 ${fmt(avg.f1)}  P@1 ${fmt(avg.page1Precision)}`,
  )
  console.log(
    `Latency POST /api/search p50 ${percentile(searchLatency, 50)} ms · max ${percentile(searchLatency, 100)} ms | paging rest p50 ${percentile(pagingLatency, 50)} ms · max ${percentile(pagingLatency, 100)} ms`,
  )
  console.log(`\nExtracted filters\n${details.join('\n')}`)

  if (failures > 0) {
    console.error(`\n✖ ${failures} quer${failures === 1 ? 'y' : 'ies'} failed`)
    process.exit(1)
  }
}

void main()
