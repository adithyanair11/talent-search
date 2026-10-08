import { describe, expect, it } from 'vitest'

import {
  briefSchema,
  EMPTY_EXTRACTION,
  extractionJsonSchema,
  extractionSchema,
  filtersSchema,
  isSearchable,
} from './filters'

type Node = Record<string, unknown>

/** Every object schema reachable from `node`. */
function objects(node: unknown, out: Node[] = []): Node[] {
  if (Array.isArray(node)) node.forEach((n) => objects(n, out))
  else if (node && typeof node === 'object') {
    const n = node as Node
    if (n.type === 'object') out.push(n)
    Object.values(n).forEach((v) => objects(v, out))
  }
  return out
}

describe('extractionJsonSchema (OpenAI strict mode)', () => {
  it('every object requires all its keys and forbids extras', () => {
    const all = objects(extractionJsonSchema)
    expect(all.length).toBeGreaterThan(3)
    for (const o of all) {
      expect(o.additionalProperties).toBe(false)
      expect(o.required).toEqual(Object.keys(o.properties as Node))
    }
  })

  it('has the same top-level keys as the zod extraction schema and the canonical filters', () => {
    const jsonKeys = Object.keys((extractionJsonSchema as { properties: Node }).properties).sort()
    expect(jsonKeys).toEqual(Object.keys(extractionSchema.shape).sort())
    expect(jsonKeys).toEqual(Object.keys(filtersSchema.shape).sort())
  })

  it('EMPTY_EXTRACTION is a valid extraction', () => {
    expect(extractionSchema.parse(EMPTY_EXTRACTION)).toEqual(EMPTY_EXTRACTION)
  })
})

describe('filtersSchema', () => {
  it('accepts canonical filters', () => {
    const f = {
      roles: ['Backend Engineer'],
      seniority: ['senior'],
      years_experience: { min: 5 },
      locations: [{ city: 'Austin' }, { state: 'CA' }],
      open_to_work: true,
      skills_all: ['Go', 'Kubernetes'],
      skills_any: ['Rust', 'Java'],
      companies: { names: ['Globalcorp'], scope: 'current' },
      company_type: { value: 'startup', scope: 'any' },
      degrees: ['PhD'],
      schools: ['MIT'],
      fields_of_study: ['Computer Science'],
      unsupported: [],
      interpretation: 'Senior backend engineers.',
    }
    expect(filtersSchema.parse(f)).toEqual(f)
  })

  it.each([
    ['unknown role', { roles: ['Wizard'] }],
    ['lower-case skill', { skills_all: ['react'] }],
    ['unknown city', { locations: [{ city: 'Oakland' }] }],
    ['city and state together', { locations: [{ city: 'Austin', state: 'TX' }] }],
    ['unknown key', { salary: 100 }],
    ['duplicates', { skills_all: ['Go', 'Go'] }],
    ['empty list', { roles: [] }],
    ['min > max', { years_experience: { min: 9, max: 3 } }],
    ['empty range', { years_experience: {} }],
    ['negative years', { years_experience: { min: -1 } }],
    ['bad scope', { company_type: { value: 'startup', scope: 'past' } }],
    ['too many notes', { unsupported: Array.from({ length: 11 }, (_, i) => `n${i}`) }],
  ])('rejects %s', (_, value) => {
    expect(filtersSchema.safeParse(value).success).toBe(false)
  })
})

describe('isSearchable', () => {
  it('needs at least one constraint', () => {
    expect(isSearchable({})).toBe(false)
    expect(isSearchable({ interpretation: 'anyone', unsupported: [] })).toBe(false)
    expect(isSearchable({ roles: ['Recruiter'] })).toBe(true)
    expect(isSearchable({ open_to_work: false })).toBe(true)
  })

  it('is false when any requirement is unsupported', () => {
    expect(isSearchable({ roles: ['Product Manager'], unsupported: ['speaks Japanese'] })).toBe(false)
  })
})

describe('briefSchema', () => {
  it('trims and bounds the brief', () => {
    expect(briefSchema.parse('  data scientists  ')).toBe('data scientists')
    expect(briefSchema.safeParse('   ').success).toBe(false)
    expect(briefSchema.safeParse('x'.repeat(501)).success).toBe(false)
    expect(briefSchema.safeParse('x'.repeat(500)).success).toBe(true)
  })
})
