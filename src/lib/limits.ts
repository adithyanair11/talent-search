/**
 * Zod-free constants and checks shared by the browser and the server. Client code imports these instead of the
 * zod schema modules, which keeps zod (~100 KB) out of every page's JavaScript. The schemas in `lib/schemas`
 * build on the same values, so client and server can't drift. See docs/decisions.md ("Performance pass").
 */
import type { Correction, Filters } from '@/lib/schemas/filters'

export const BRIEF_MAX_LENGTH = 500
export const MAX_YEARS = 50

export const SCOPES = ['any', 'current'] as const

/** Filter keys that constrain who matches (everything except the explanatory fields). */
export const CONSTRAINT_KEYS = [
  'roles',
  'seniority',
  'years_experience',
  'locations',
  'open_to_work',
  'skills_all',
  'skills_any',
  'companies',
  'company_type',
  'degrees',
  'schools',
  'fields_of_study',
] as const satisfies readonly (keyof Filters)[]

/** Chip text for a corrected typo: "Android (corrected from Andriod)". */
export function formatCorrection(c: Correction): string {
  return `${c.to} (corrected from ${c.from})`
}

export const SHORTLIST_NAME_MAX = 60
/** How many member avatars a list summary carries (the card shows a stack of them). */
export const SHORTLIST_AVATARS = 4
export const SHORTLIST_NAME_MESSAGES = {
  empty: 'Give the list a name.',
  tooLong: `Keep the name to ${SHORTLIST_NAME_MAX} characters or fewer.`,
} as const

/** Same rule as `shortlistNameSchema` (trimmed, 1–60 chars), for form feedback without zod. */
export function checkShortlistName(raw: string): { name: string } | { error: string } {
  const name = raw.trim()
  if (name.length < 1) return { error: SHORTLIST_NAME_MESSAGES.empty }
  if (name.length > SHORTLIST_NAME_MAX) return { error: SHORTLIST_NAME_MESSAGES.tooLong }
  return { name }
}

// zod 4's `z.uuid()` pattern (RFC 9562 versions 1–8, plus the nil and max UUIDs); limits.test.ts keeps them equal.
const UUID = /^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$/

export const isUuid = (s: string): boolean => UUID.test(s)
