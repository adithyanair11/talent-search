import 'server-only'

import { HttpError } from '@/lib/http'
import { filtersSchema } from '@/lib/schemas/filters'
import type { CreateSavedBriefResponse, SavedBrief, SavedBriefBody } from '@/lib/schemas/saved-briefs'

import type { RequestContext } from '../auth'

/**
 * Company saved searches (brief + filters). Every query runs through the caller's RLS client, so another
 * company's row is simply not visible and surfaces as 404 (never 403).
 */

const NOT_FOUND = 'Saved search not found.'

function fail(what: string, error: { message: string }): never {
  throw new Error(`${what} failed: ${error.message}`)
}

export async function listSavedBriefs(ctx: RequestContext): Promise<SavedBrief[]> {
  const { data, error } = await ctx.supabase
    .from('saved_briefs')
    .select('id, brief, filters, created_at')
    .order('created_at', { ascending: false })
    .order('id')
  if (error) fail('saved brief list', error)
  // Rows were validated on write; re-parse so a vocabulary change can never hand the UI an unknown value.
  return data.map((row) => {
    const parsed = filtersSchema.safeParse(row.filters)
    return { id: row.id, brief: row.brief, filters: parsed.success ? parsed.data : {}, created_at: row.created_at }
  })
}

export async function createSavedBrief(ctx: RequestContext, body: SavedBriefBody): Promise<CreateSavedBriefResponse> {
  // company_id defaults from private.current_company_id(); the grant only allows inserting `brief, filters`.
  const { data, error } = await ctx.supabase
    .from('saved_briefs')
    .insert({ brief: body.brief, filters: body.filters })
    .select('id')
    .single()
  if (error) fail('saved brief create', error)
  return { id: data.id }
}

export async function deleteSavedBrief(ctx: RequestContext, id: string): Promise<void> {
  const { data, error } = await ctx.supabase.from('saved_briefs').delete().eq('id', id).select('id')
  if (error) fail('saved brief delete', error)
  if (data.length === 0) throw new HttpError('not_found', NOT_FOUND)
}
