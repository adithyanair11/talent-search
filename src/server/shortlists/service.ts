import 'server-only'

import { HttpError } from '@/lib/http'
import {
  SHORTLIST_AVATARS,
  type AddPersonResponse,
  type CreateShortlistResponse,
  type RenameShortlistResponse,
  type ShortlistDetail,
  type ShortlistMember,
  type ShortlistSummary,
} from '@/lib/schemas/shortlists'

import type { RequestContext } from '../auth'

/**
 * Company shortlists. Every query runs through the caller's RLS client, so another company's list is simply not
 * visible and surfaces as 404 (never 403: we don't confirm it exists). Names are unique per company,
 * case-insensitively (`shortlists_company_name_key`).
 */

const NOT_FOUND = 'Shortlist not found.'

type PgError = { code?: string; message: string }

function duplicateName(name: string): HttpError {
  return new HttpError('conflict', `You already have a list called “${name}”. Pick another name.`)
}

function fail(what: string, error: PgError): never {
  throw new Error(`${what} failed: ${error.message}`)
}

async function assertVisible(ctx: RequestContext, id: string): Promise<{ id: string; name: string }> {
  const { data, error } = await ctx.supabase.from('shortlists').select('id, name').eq('id', id).maybeSingle()
  if (error) fail('shortlist lookup', error)
  if (!data) throw new HttpError('not_found', NOT_FOUND)
  return data
}

export async function listShortlists(ctx: RequestContext): Promise<ShortlistSummary[]> {
  const { data, error } = await ctx.supabase
    .from('shortlists')
    .select('id, name, created_at, updated_at, shortlist_people(person_id, added_at, candidates(avatar_url))')
    .order('created_at', { ascending: false })
    .order('id')
  if (error) fail('shortlist list', error)

  return data.map((list) => {
    const members = [...list.shortlist_people].sort(
      (a, b) => b.added_at.localeCompare(a.added_at) || a.person_id.localeCompare(b.person_id),
    )
    return {
      id: list.id,
      name: list.name,
      count: members.length,
      avatar_urls: members
        .map((m) => m.candidates?.avatar_url)
        .filter((url): url is string => Boolean(url))
        .slice(0, SHORTLIST_AVATARS),
      person_ids: members.map((m) => m.person_id),
      created_at: list.created_at,
      updated_at: list.updated_at,
    }
  })
}

const MEMBER_COLUMNS =
  'added_at, candidates(id, full_name, avatar_url, headline, current_title, current_company, ' +
  'current_company_logo_url, years_experience, city, state, country, open_to_work, skills)'

type MemberRow = {
  added_at: string
  candidates: {
    id: string
    full_name: string
    avatar_url: string
    headline: string
    current_title: string
    current_company: string
    current_company_logo_url: string
    years_experience: number
    city: string
    state: string
    country: string
    open_to_work: boolean
    skills: string[]
  } | null
}

export async function getShortlist(ctx: RequestContext, id: string): Promise<ShortlistDetail> {
  const list = await assertVisible(ctx, id)
  const { data, error } = await ctx.supabase
    .from('shortlist_people')
    .select(MEMBER_COLUMNS)
    .eq('shortlist_id', id)
    .order('added_at', { ascending: false })
    .order('person_id')
    .returns<MemberRow[]>()
  if (error) fail('shortlist members', error)

  const people: ShortlistMember[] = []
  for (const row of data) {
    const c = row.candidates
    if (!c) continue
    people.push({
      id: c.id,
      full_name: c.full_name,
      headline: c.headline,
      avatar_url: c.avatar_url,
      current_title: c.current_title,
      current_company: c.current_company,
      current_company_logo_url: c.current_company_logo_url,
      years_experience: c.years_experience,
      location: { city: c.city, state: c.state, country: c.country },
      open_to_work: c.open_to_work,
      skills: c.skills,
      added_at: row.added_at,
    })
  }
  return { id: list.id, name: list.name, count: people.length, people }
}

export async function createShortlist(ctx: RequestContext, name: string): Promise<CreateShortlistResponse> {
  // company_id defaults from private.current_company_id(); the grant only allows inserting `name`.
  const { data, error } = await ctx.supabase.from('shortlists').insert({ name }).select('id').single()
  if (error?.code === '23505') throw duplicateName(name)
  if (error) fail('shortlist create', error)
  return { id: data.id }
}

export async function renameShortlist(ctx: RequestContext, id: string, name: string): Promise<RenameShortlistResponse> {
  const { data, error } = await ctx.supabase.from('shortlists').update({ name }).eq('id', id).select('id, name')
  if (error?.code === '23505') throw duplicateName(name)
  if (error) fail('shortlist rename', error)
  if (data.length === 0) throw new HttpError('not_found', NOT_FOUND)
  return data[0]
}

export async function deleteShortlist(ctx: RequestContext, id: string): Promise<void> {
  const { data, error } = await ctx.supabase.from('shortlists').delete().eq('id', id).select('id')
  if (error) fail('shortlist delete', error)
  if (data.length === 0) throw new HttpError('not_found', NOT_FOUND)
}

/** Idempotent: adding someone who is already on the list is a no-op (`added: false`). */
export async function addPerson(ctx: RequestContext, shortlistId: string, personId: string): Promise<AddPersonResponse> {
  await assertVisible(ctx, shortlistId)
  // ON CONFLICT DO NOTHING: needs only the insert grant; a repeat returns no row.
  const { data, error } = await ctx.supabase
    .from('shortlist_people')
    .upsert({ shortlist_id: shortlistId, person_id: personId }, { onConflict: 'shortlist_id,person_id', ignoreDuplicates: true })
    .select('person_id')
  if (error?.code === '23503') throw new HttpError('not_found', 'Candidate not found.')
  if (error) fail('shortlist add', error)
  return { shortlist_id: shortlistId, person_id: personId, added: data.length > 0 }
}

/** Idempotent: removing someone who isn't on the list succeeds. */
export async function removePerson(ctx: RequestContext, shortlistId: string, personId: string): Promise<void> {
  await assertVisible(ctx, shortlistId)
  const { error } = await ctx.supabase
    .from('shortlist_people')
    .delete()
    .eq('shortlist_id', shortlistId)
    .eq('person_id', personId)
  if (error) fail('shortlist remove', error)
}
