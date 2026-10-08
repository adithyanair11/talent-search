/** Contracts for `/api/shortlists/*` (CLAUDE.md). */
import { z } from 'zod'

import { SHORTLIST_NAME_MAX, SHORTLIST_NAME_MESSAGES } from '@/lib/limits'

import type { SearchResult } from './search'

export { SHORTLIST_AVATARS, SHORTLIST_NAME_MAX } from '@/lib/limits'

export const shortlistNameSchema = z
  .string()
  .trim()
  .min(1, SHORTLIST_NAME_MESSAGES.empty)
  .max(SHORTLIST_NAME_MAX, SHORTLIST_NAME_MESSAGES.tooLong)

/** Body of `POST /api/shortlists` and `PATCH /api/shortlists/{id}`. */
export const shortlistBodySchema = z.object({ name: shortlistNameSchema }).strict()
export type ShortlistBody = z.infer<typeof shortlistBodySchema>

export const shortlistIdSchema = z.uuid()

export type ShortlistSummary = {
  id: string
  name: string
  count: number
  /** Up to `SHORTLIST_AVATARS` member avatars, most recently added first. */
  avatar_urls: string[]
  /** Every member id: drives "is this person on any list" and the popover checkboxes from one query. */
  person_ids: string[]
  created_at: string
  updated_at: string
}

export type ShortlistsResponse = { shortlists: ShortlistSummary[] }

export type ShortlistMember = SearchResult & { added_at: string }

export type ShortlistDetail = {
  id: string
  name: string
  count: number
  /** Most recently added first. */
  people: ShortlistMember[]
}

export type CreateShortlistResponse = { id: string }
export type RenameShortlistResponse = { id: string; name: string }
export type AddPersonResponse = { shortlist_id: string; person_id: string; added: boolean }
