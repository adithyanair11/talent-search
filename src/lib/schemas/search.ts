/** Request/response contracts for `POST /api/search` and `GET /api/search/{search_id}` (CLAUDE.md). */
import { z } from 'zod'

import type { CandidateSummary } from '@/lib/candidate'

import { briefSchema, filtersSchema, type Filters } from './filters'

export const PAGE_SIZE = 20
export const MAX_PAGE = 10_000

/** `filters` present = recruiter-edited filters: the LLM is skipped. */
export const searchRequestSchema = z.object({ brief: briefSchema, filters: filtersSchema.optional() }).strict()
export type SearchRequest = z.infer<typeof searchRequestSchema>

export const searchIdSchema = z.uuid()

export const pageSchema = z.coerce.number().int().min(1).max(MAX_PAGE).default(1)

export type SearchResult = CandidateSummary & { headline: string }

export type SearchResponse = {
  search_id: string
  filters: Filters
  total: number
  results: SearchResult[]
  searches_remaining: number | null
}

export type SearchPageResponse = {
  search_id: string
  filters: Filters
  total: number
  page: number
  results: SearchResult[]
}
