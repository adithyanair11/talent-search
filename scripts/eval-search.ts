/**
 * Search accuracy eval — the source of truth for search quality (CLAUDE.md "Search rules" #7).
 *
 * For every brief in data/queries.json: run the search, collect every result id in rank order, and report
 * precision, recall, F1, page-1 precision and latency per query plus macro averages and the filters used.
 *
 * Backend: until POST /api/search exists this runs in-process — LLM extraction → normalization → a temporary
 * matcher (scripts/lib/temp-search.ts). It calls the services directly, so no company's plan or search
 * counter is involved. When the route lands, an API backend replaces it (see docs/decisions.md).
 *
 * Run with `npm run eval` (local Supabase running + seeded, OPENAI_API_KEY set). `--verbose` also prints
 * the raw model output. Exits 1 if any query errors.
 */
import './lib/env'

import { readFileSync } from 'node:fs'
import path from 'node:path'

import type { Extraction, Filters } from '../src/lib/schemas/filters'
import { extractFilters, getModel } from '../src/server/llm/extract-filters'
import { normalizeFilters } from '../src/server/search/normalize'
import { requireEnv } from './lib/env'
import { macroAverage, percentile, scoreQuery, type QueryScore } from './lib/eval-metrics'
import { tempSearch } from './lib/temp-search'

interface Query {
  brief: string
  expected_ids: string[]
}

interface SearchRun {
  filters: Filters
  raw?: Extraction
  ids: string[]
  llmMs: number
  totalMs: number
}

interface SearchBackend {
  name: string
  search(brief: string): Promise<SearchRun>
}

const inProcessBackend: SearchBackend = {
  name: 'in-process (extract → normalize → temporary matcher)',
  async search(brief) {
    const started = performance.now()
    const { raw, latencyMs } = await extractFilters(brief)
    const filters = normalizeFilters(raw)
    const ids = await tempSearch(filters)
    return { filters, raw, ids, llmMs: latencyMs, totalMs: Math.round(performance.now() - started) }
  },
}

const verbose = process.argv.includes('--verbose')
const fmt = (n: number) => n.toFixed(3)
const pad = (s: string | number, n: number) => String(s).padStart(n)

async function main(): Promise<void> {
  requireEnv('OPENAI_API_KEY')
  requireEnv('NEXT_PUBLIC_SUPABASE_URL')
  requireEnv('SUPABASE_SECRET_KEY')

  const queries = JSON.parse(
    readFileSync(path.resolve(process.cwd(), 'data/queries.json'), 'utf8'),
  ) as Query[]
  const backend = inProcessBackend
  console.log(`Search eval — ${queries.length} briefs · model ${getModel()} · backend ${backend.name}\n`)

  const scores: QueryScore[] = []
  const llm: number[] = []
  const total: number[] = []
  let failures = 0

  console.log(` #  ${pad('P', 6)} ${pad('R', 6)} ${pad('F1', 6)} ${pad('P@1', 6)} ${pad('got/exp', 9)} ${pad('LLM ms', 7)} ${pad('total', 6)}  brief`)
  const details: string[] = []

  for (const [i, q] of queries.entries()) {
    const n = pad(i + 1, 2)
    try {
      const run = await backend.search(q.brief)
      const s = scoreQuery(run.ids, q.expected_ids)
      scores.push(s)
      llm.push(run.llmMs)
      total.push(run.totalMs)
      console.log(
        `${n}  ${pad(fmt(s.precision), 6)} ${pad(fmt(s.recall), 6)} ${pad(fmt(s.f1), 6)} ${pad(fmt(s.page1Precision), 6)} ${pad(`${run.ids.length}/${q.expected_ids.length}`, 9)} ${pad(run.llmMs, 7)} ${pad(run.totalMs, 6)}  ${q.brief}`,
      )
      details.push(`${n}  ${q.brief}\n    filters: ${JSON.stringify(run.filters)}`)
      if (verbose && run.raw) details.push(`    raw:     ${JSON.stringify(run.raw)}`)
    } catch (error) {
      failures++
      scores.push({ precision: 0, recall: 0, f1: 0, page1Precision: 0 })
      const message = error instanceof Error ? error.message : String(error)
      console.log(`${n}  ERROR ${message}  ${q.brief}`)
    }
  }

  const avg = macroAverage(scores)
  console.log(
    `\nMacro   P ${fmt(avg.precision)}  R ${fmt(avg.recall)}  F1 ${fmt(avg.f1)}  P@1 ${fmt(avg.page1Precision)}`,
  )
  console.log(
    `Latency LLM p50 ${percentile(llm, 50)} ms · max ${percentile(llm, 100)} ms | total p50 ${percentile(total, 50)} ms · max ${percentile(total, 100)} ms`,
  )
  console.log(`\nExtracted filters\n${details.join('\n')}`)

  if (failures > 0) {
    console.error(`\n✖ ${failures} quer${failures === 1 ? 'y' : 'ies'} failed`)
    process.exit(1)
  }
}

void main()
