/**
 * Search filter schemas (docs/data-notes.md §4).
 *
 * - `filtersSchema`: canonical filters — every value is an exact vocabulary value. This is what search
 *   consumes and what recruiter-edited filters must pass.
 * - `extractionSchema` / `extractionJsonSchema`: what the LLM emits. Same shape, but values are free strings
 *   (the normalizer maps them onto the vocabulary or into `unsupported`) and every key is required + nullable,
 *   as OpenAI strict structured outputs demand. See docs/decisions.md ("Search: extraction & eval").
 */
import { z } from 'zod'

import {
  CITY_NAMES,
  COMPANY_NAMES,
  COMPANY_TYPES,
  DEGREES,
  FIELDS_OF_STUDY,
  ROLES,
  SCHOOLS,
  SENIORITIES,
  SKILLS,
  STATES,
} from '@/lib/vocabulary'

export const BRIEF_MAX_LENGTH = 500
export const MAX_YEARS = 50
const MAX_LIST = 20
const MAX_UNSUPPORTED = 10
const MAX_NOTE = 200
const MAX_INTERPRETATION = 300

export const briefSchema = z.string().trim().min(1).max(BRIEF_MAX_LENGTH)

export const SCOPES = ['any', 'current'] as const

/** A non-empty list without duplicates. */
function list<T extends z.ZodType<string>>(item: T) {
  return z
    .array(item)
    .min(1)
    .max(MAX_LIST)
    .refine((xs) => new Set(xs).size === xs.length, 'must not contain duplicates')
}

const years = z.number().int().min(0).max(MAX_YEARS)

export const filtersSchema = z
  .object({
    roles: list(z.enum(ROLES)),
    seniority: list(z.enum(SENIORITIES)),
    years_experience: z
      .object({ min: years.optional(), max: years.optional() })
      .strict()
      .refine((r) => r.min !== undefined || r.max !== undefined, 'min or max is required')
      .refine((r) => r.min === undefined || r.max === undefined || r.min <= r.max, 'min must be ≤ max'),
    locations: z
      .array(
        z.union([
          z.object({ city: z.enum(CITY_NAMES) }).strict(),
          z.object({ state: z.enum(STATES) }).strict(),
        ]),
      )
      .min(1)
      .max(MAX_LIST),
    open_to_work: z.boolean(),
    skills_all: list(z.enum(SKILLS)),
    skills_any: list(z.enum(SKILLS)),
    companies: z.object({ names: list(z.enum(COMPANY_NAMES)), scope: z.enum(SCOPES) }).strict(),
    company_type: z.object({ value: z.enum(COMPANY_TYPES), scope: z.enum(SCOPES) }).strict(),
    degrees: list(z.enum(DEGREES)),
    schools: list(z.enum(SCHOOLS)),
    fields_of_study: list(z.enum(FIELDS_OF_STUDY)),
    unsupported: z.array(z.string().trim().min(1).max(MAX_NOTE)).max(MAX_UNSUPPORTED),
    /** Nice-to-haves ("ideally …"). Informational only — never a constraint, never narrows results. */
    preferences: z.array(z.string().trim().min(1).max(MAX_NOTE)).max(MAX_UNSUPPORTED),
    interpretation: z.string().trim().max(MAX_INTERPRETATION),
  })
  .partial()
  .strict()

export type Filters = z.infer<typeof filtersSchema>

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

/**
 * "Never return everyone": a search runs only when at least one supported constraint exists and no
 * requirement was left unsupported. Otherwise the result is empty and `unsupported` explains why.
 */
export function isSearchable(filters: Filters): boolean {
  if ((filters.unsupported?.length ?? 0) > 0) return false
  return CONSTRAINT_KEYS.some((k) => filters[k] !== undefined)
}

// ---------------------------------------------------------------------------------------------------------
// LLM extraction
// ---------------------------------------------------------------------------------------------------------

const rawList = z.array(z.string()).nullable()

export const extractionSchema = z
  .object({
    roles: rawList,
    seniority: rawList,
    years_experience: z
      .object({ min: z.number().int().nullable(), max: z.number().int().nullable() })
      .strict()
      .nullable(),
    locations: rawList,
    open_to_work: z.boolean().nullable(),
    skills_all: rawList,
    skills_any: rawList,
    companies: z.object({ names: z.array(z.string()), scope: z.enum(SCOPES) }).strict().nullable(),
    company_type: z.object({ value: z.string(), scope: z.enum(SCOPES) }).strict().nullable(),
    degrees: rawList,
    schools: rawList,
    fields_of_study: rawList,
    unsupported: z.array(z.string()),
    preferences: z.array(z.string()),
    interpretation: z.string(),
  })
  .strict()

export type Extraction = z.infer<typeof extractionSchema>

/** An extraction with nothing in it. */
export const EMPTY_EXTRACTION: Extraction = {
  roles: null,
  seniority: null,
  years_experience: null,
  locations: null,
  open_to_work: null,
  skills_all: null,
  skills_any: null,
  companies: null,
  company_type: null,
  degrees: null,
  schools: null,
  fields_of_study: null,
  unsupported: [],
  preferences: [],
  interpretation: '',
}

type JsonSchema = Record<string, unknown>

function strictObject(properties: Record<string, JsonSchema>): JsonSchema {
  return { type: 'object', properties, required: Object.keys(properties), additionalProperties: false }
}
function nullable(schema: JsonSchema): JsonSchema {
  return { anyOf: [schema, { type: 'null' }] }
}
function strings(description: string): JsonSchema {
  return nullable({ type: 'array', items: { type: 'string' }, description })
}
const scope: JsonSchema = {
  type: 'string',
  enum: [...SCOPES],
  description: '"any" = any job, current or past (default). "current" only when the brief says currently.',
}

/** JSON Schema for OpenAI strict structured outputs. Must stay in sync with `extractionSchema` (tested). */
export const extractionJsonSchema: JsonSchema = strictObject({
  roles: strings('Job roles (OR). null if the brief names no specific role.'),
  seniority: strings('Level words exactly as levels: junior, mid, senior, staff (or the brief\'s level word).'),
  years_experience: nullable(
    strictObject({
      min: { type: ['integer', 'null'] },
      max: { type: ['integer', 'null'] },
    }),
  ),
  locations: strings('Place names from the brief (OR), e.g. a city or a US state.'),
  open_to_work: { type: ['boolean', 'null'] },
  skills_all: strings('Skills the candidate must ALL have.'),
  skills_any: strings('Skills where at least one is enough — only for an explicit "X or Y".'),
  companies: nullable(strictObject({ names: { type: 'array', items: { type: 'string' } }, scope })),
  company_type: nullable(
    strictObject({ value: { type: 'string', description: 'startup or enterprise' }, scope }),
  ),
  degrees: strings('Degrees, e.g. PhD, MS, BS, MBA, "master\'s".'),
  schools: strings('Schools as written in the brief.'),
  fields_of_study: strings('Fields of study, e.g. Computer Science.'),
  unsupported: {
    type: 'array',
    items: { type: 'string' },
    description: 'Requirements no field can express, each as a short phrase.',
  },
  preferences: {
    type: 'array',
    items: { type: 'string' },
    description: 'Nice-to-haves the brief marks as optional (ideally, a plus, bonus, preferably), as short phrases.',
  },
  interpretation: { type: 'string', description: 'One short sentence describing who is being searched for.' },
})
