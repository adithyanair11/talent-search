/** Contracts for `/api/saved-briefs/*` (CLAUDE.md). */
import { z } from 'zod'

import { briefSchema, filtersSchema, type Filters } from './filters'

/** Body of `POST /api/saved-briefs`: the brief plus its (possibly recruiter-edited) canonical filters. */
export const savedBriefBodySchema = z.object({ brief: briefSchema, filters: filtersSchema }).strict()
export type SavedBriefBody = z.infer<typeof savedBriefBodySchema>

export const savedBriefIdSchema = z.uuid()

export type SavedBrief = {
  id: string
  brief: string
  filters: Filters
  created_at: string
}

export type SavedBriefsResponse = { saved_briefs: SavedBrief[] }
export type CreateSavedBriefResponse = { id: string }
