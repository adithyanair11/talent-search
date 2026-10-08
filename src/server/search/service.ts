import 'server-only'

import { HttpError } from '@/lib/http'
import { filtersSchema, type Filters } from '@/lib/schemas/filters'
import type { SearchPageResponse, SearchRequest, SearchResponse, SearchResult } from '@/lib/schemas/search'
import type { Database } from '@/lib/database.types'

import type { RequestContext } from '../auth'
import { extractFiltersCached, FilterExtractionError } from '../llm/extract-filters'
import { getPlan } from '../plan'
import { filtersToExtraction, normalizeFilters } from './normalize'

/**
 * Search = brief → filters (LLM, or recruiter-edited filters) → `public.run_search` (quota + ranked snapshot,
 * one transaction) → page 1. Paging reads the stored snapshot only. Every query runs through the caller's RLS
 * client. See docs/decisions.md ("Search: find & rank").
 */

type PageRow = Database['public']['Functions']['search_page']['Returns'][number]

const QUOTA_MESSAGE = "You've used your free search. Upgrade to keep searching."
export const BUSY_MESSAGE = 'Search is busy, please try again'
export const BUSY_RETRY_AFTER_SECONDS = 2

function toResult(row: PageRow): SearchResult {
  return {
    id: row.id,
    full_name: row.full_name,
    headline: row.headline,
    avatar_url: row.avatar_url,
    current_title: row.current_title,
    current_company: row.current_company,
    current_company_logo_url: row.current_company_logo_url,
    years_experience: row.years_experience,
    location: { city: row.city, state: row.state, country: row.country },
    open_to_work: row.open_to_work,
    skills: row.skills,
  }
}

async function resolveFilters(input: SearchRequest): Promise<Filters> {
  if (input.filters) return normalizeFilters(filtersToExtraction(input.filters))
  try {
    const { raw } = await extractFiltersCached(input.brief)
    return normalizeFilters(raw)
  } catch (err) {
    if (!(err instanceof FilterExtractionError)) throw err
    console.error('[search] filter extraction failed', err.reason, err.message)
    if (err.reason === 'refused') {
      throw new HttpError('unprocessable', "We couldn't interpret this brief. Try describing the people you want.")
    }
    // Timed out, unreachable or garbled: the model is the problem, not the request, and nothing was consumed
    // (quota is only taken inside run_search, which never ran). A retry is likely to work.
    throw new HttpError('search_unavailable', BUSY_MESSAGE, { retryAfterSeconds: BUSY_RETRY_AFTER_SECONDS })
  }
}

async function fetchPage(ctx: RequestContext, searchId: string, page: number): Promise<SearchResult[]> {
  const { data, error } = await ctx.supabase.rpc('search_page', { p_search_id: searchId, p_page: page })
  if (error) throw new Error(`search_page failed: ${error.message}`)
  return data.map(toResult)
}

export async function runSearch(ctx: RequestContext, input: SearchRequest): Promise<SearchResponse> {
  // Cheap pre-check so an exhausted free plan gets its 402 before we pay for an LLM call. run_search enforces
  // the limit atomically; this only short-circuits the common case.
  const plan = await getPlan(ctx)
  if (plan.plan === 'free' && plan.searches_remaining === 0) throw new HttpError('payment_required', QUOTA_MESSAGE)

  const filters = await resolveFilters(input)

  const { data, error } = await ctx.supabase
    .rpc('run_search', { p_brief: input.brief, p_filters: filters })
    .single()
  if (error) {
    if (error.code === 'PT402') throw new HttpError('payment_required', QUOTA_MESSAGE)
    if (error.code === '22023') throw new HttpError('unprocessable', 'These filters cannot be searched.')
    throw new Error(`run_search failed: ${error.code} ${error.message}`)
  }

  return {
    search_id: data.search_id,
    filters,
    total: data.total,
    results: data.total > 0 ? await fetchPage(ctx, data.search_id, 1) : [],
    // Generated types can't express the nullable column of a table-returning function.
    searches_remaining: (data.searches_remaining as number | null) ?? null,
  }
}

export async function getSearchPage(
  ctx: RequestContext,
  searchId: string,
  page: number,
): Promise<SearchPageResponse> {
  const [search, results] = await Promise.all([
    ctx.supabase.from('searches').select('id, filters, total').eq('id', searchId).maybeSingle(),
    fetchPage(ctx, searchId, page),
  ])
  if (search.error) throw new Error(`search read failed: ${search.error.message}`)
  // RLS: another company's search is indistinguishable from a missing one.
  if (!search.data) throw new HttpError('not_found', 'Search not found.')

  const filters = filtersSchema.safeParse(search.data.filters)
  return {
    search_id: search.data.id,
    filters: filters.success ? filters.data : {},
    total: search.data.total,
    page,
    results,
  }
}
