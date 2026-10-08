import { describe, expect, it } from 'vitest'

import { EMPTY_EXTRACTION, isSearchable, type Extraction, type Filters } from '@/lib/schemas/filters'
import { CITIES, COMPANY_NAMES, DEGREES, FIELDS_OF_STUDY, ROLES, SCHOOLS, SKILLS } from '@/lib/vocabulary'

import { ENGINEERING_ROLES, key, normalizeFilters } from './normalize'

const norm = (partial: Partial<Extraction>): Filters => normalizeFilters({ ...EMPTY_EXTRACTION, ...partial })
const notes = (f: Filters) => f.unsupported ?? []

describe('key', () => {
  it('ignores case, spacing, punctuation and accents', () => {
    expect(key(' Front-End  Engineer ')).toBe(key('frontend engineer'))
    expect(key('Node.js')).toBe('nodejs')
    expect(key('CI/CD')).toBe('cicd')
    expect(key('Café')).toBe('cafe')
  })

  it('keeps + and # so C++ / C# never collapse to C', () => {
    expect(key('C++')).toBe('c++')
    expect(key('C#')).toBe('c#')
  })
})

describe('empty and pass-through', () => {
  it('an empty extraction yields no constraints and is not searchable', () => {
    const f = norm({})
    expect(f).toEqual({ unsupported: [] })
    expect(isSearchable(f)).toBe(false)
  })

  it('blank strings are ignored', () => {
    expect(norm({ roles: ['  ', ''], skills_all: [''] })).toEqual({ unsupported: [] })
  })

  it('keeps the interpretation (trimmed, capped)', () => {
    expect(norm({ interpretation: '  Senior  people. ' }).interpretation).toBe('Senior people.')
    expect(norm({ interpretation: 'x'.repeat(400) }).interpretation).toHaveLength(300)
  })

  it('keeps model-reported unsupported notes, deduped', () => {
    expect(notes(norm({ unsupported: ['speaks Japanese', 'Speaks Japanese', ' remote '] }))).toEqual([
      'speaks Japanese',
      'remote',
    ])
  })

  it('keeps preferences as information only — they never become constraints', () => {
    const f = norm({ roles: ['recruiters'], preferences: [' Greenhouse ', 'Greenhouse', ''] })
    expect(f.preferences).toEqual(['Greenhouse'])
    expect(f.skills_all).toBeUndefined()
    expect(isSearchable(f)).toBe(true)
    expect(isSearchable(norm({ preferences: ['startup'] }))).toBe(false)
  })

  it('is idempotent on canonical vocabulary values', () => {
    for (const role of ROLES) expect(norm({ roles: [role] }).roles).toEqual([role])
    for (const skill of SKILLS) expect(norm({ skills_all: [skill] }).skills_all).toEqual([skill])
    for (const { city } of CITIES) expect(norm({ locations: [city] }).locations).toEqual([{ city }])
    for (const school of SCHOOLS) expect(norm({ schools: [school] }).schools).toEqual([school])
    for (const field of FIELDS_OF_STUDY) {
      expect(norm({ fields_of_study: [field] }).fields_of_study).toEqual([field])
    }
    for (const degree of DEGREES) expect(norm({ degrees: [degree] }).degrees).toEqual([degree])
    for (const name of COMPANY_NAMES) {
      expect(norm({ companies: { names: [name], scope: 'any' } }).companies).toEqual({ names: [name], scope: 'any' })
    }
  })
})

describe('roles', () => {
  it.each([
    ['frontend engineers', 'Frontend Engineer'],
    ['Front-end developer', 'Frontend Engineer'],
    ['UI engineer', 'Frontend Engineer'],
    ['full-stack engineers', 'Full Stack Engineer'],
    ['fullstack devs', 'Full Stack Engineer'],
    ['back end developers', 'Backend Engineer'],
    ['ML engineers', 'Machine Learning Engineer'],
    ['MLE', 'Machine Learning Engineer'],
    ['machine learning engineers', 'Machine Learning Engineer'],
    ['data scientists', 'Data Scientist'],
    ['data engineers', 'Data Engineer'],
    ['SREs', 'DevOps Engineer'],
    ['platform engineer', 'DevOps Engineer'],
    ['devops', 'DevOps Engineer'],
    ['iOS developers', 'Mobile Engineer'],
    ['android engineer', 'Mobile Engineer'],
    ['AEs', 'Account Executive'],
    ['sales reps', 'Account Executive'],
    ['PMs', 'Product Manager'],
    ['UX designers', 'Product Designer'],
    ['designers', 'Product Designer'],
    ['talent partners', 'Recruiter'],
    ['marketing managers', 'Marketing Manager'],
  ])('%s → %s', (raw, role) => {
    const f = norm({ roles: [raw] })
    expect(f.roles).toEqual([role])
    expect(notes(f)).toEqual([])
  })

  it('a generic engineer/developer means every engineering role', () => {
    for (const raw of ['engineers', 'developer', 'software engineers', 'SWE']) {
      expect(norm({ roles: [raw] }).roles).toEqual(ENGINEERING_ROLES)
    }
    expect(ENGINEERING_ROLES).toHaveLength(7)
    expect(ENGINEERING_ROLES).not.toContain('Product Manager')
  })

  it('"<skill> engineers" → engineering roles + the skill', () => {
    const f = norm({ roles: ['React engineers'] })
    expect(f.roles).toEqual(ENGINEERING_ROLES)
    expect(f.skills_all).toEqual(['React'])
    expect(norm({ roles: ['Golang developers'] }).skills_all).toEqual(['Go'])
  })

  it('a role alias wins over the skill split ("iOS engineer" is a Mobile Engineer, not iOS skill)', () => {
    const f = norm({ roles: ['iOS engineer'] })
    expect(f.roles).toEqual(['Mobile Engineer'])
    expect(f.skills_all).toBeUndefined()
  })

  it('several roles are OR-ed and deduped', () => {
    expect(norm({ roles: ['frontend', 'Frontend Engineer', 'full stack'] }).roles).toEqual([
      'Frontend Engineer',
      'Full Stack Engineer',
    ])
  })

  it.each(['data analyst', 'CTO', 'nurse', 'Angular engineer'])('unknown role %s → unsupported', (raw) => {
    const f = norm({ roles: [raw] })
    expect(f.roles).toBeUndefined()
    expect(notes(f)).toEqual([`role "${raw}" is not in the data`])
  })
})

describe('seniority', () => {
  it.each([
    ['Senior', 'senior'],
    ['sr', 'senior'],
    ['jr.', 'junior'],
    ['entry-level', 'junior'],
    ['new grads', 'junior'],
    ['mid-level', 'mid'],
    ['intermediate', 'mid'],
    ['STAFF', 'staff'],
  ])('%s → %s', (raw, level) => {
    expect(norm({ seniority: [raw] }).seniority).toEqual([level])
  })

  it('never expands a level (senior does not include staff)', () => {
    expect(norm({ seniority: ['senior'] }).seniority).toEqual(['senior'])
  })

  it.each(['lead', 'principal', 'director', 'head of', 'intern'])('%s is not a level in the data', (raw) => {
    const f = norm({ seniority: [raw] })
    expect(f.seniority).toBeUndefined()
    expect(notes(f)).toEqual([`level "${raw}" is not in the data`])
  })
})

describe('years_experience', () => {
  it('passes explicit ranges', () => {
    expect(norm({ years_experience: { min: 5, max: null } }).years_experience).toEqual({ min: 5 })
    expect(norm({ years_experience: { min: 3, max: 7 } }).years_experience).toEqual({ min: 3, max: 7 })
    expect(norm({ years_experience: { min: null, max: 2 } }).years_experience).toEqual({ max: 2 })
  })

  it('drops a no-op range', () => {
    expect(norm({ years_experience: { min: null, max: null } }).years_experience).toBeUndefined()
    expect(norm({ years_experience: { min: 0, max: null } }).years_experience).toBeUndefined()
  })

  it.each([
    [{ min: 9, max: 3 }],
    [{ min: -2, max: null }],
    [{ min: null, max: 80 }],
  ])('invalid range %j → unsupported', (range) => {
    const f = norm({ years_experience: range })
    expect(f.years_experience).toBeUndefined()
    expect(notes(f)).toHaveLength(1)
  })
})

describe('locations', () => {
  it.each([
    ['NYC', { city: 'New York' }],
    ['New York City', { city: 'New York' }],
    ['new york', { city: 'New York' }],
    ['Manhattan', { city: 'New York' }],
    ['SF', { city: 'San Francisco' }],
    ['Bay Area', { city: 'San Francisco' }],
    ['LA', { city: 'Los Angeles' }],
    ['Austin, TX', { city: 'Austin' }],
    ['Seattle, WA, USA', { city: 'Seattle' }],
    ['California', { state: 'CA' }],
    ['CA', { state: 'CA' }],
    ['texas', { state: 'TX' }],
    ['Washington state', { state: 'WA' }],
    ['NY', { state: 'NY' }],
  ])('%s → %j', (raw, location) => {
    const f = norm({ locations: [raw] })
    expect(f.locations).toEqual([location])
    expect(notes(f)).toEqual([])
  })

  it('a city is not its state (San Francisco ≠ CA)', () => {
    expect(norm({ locations: ['San Francisco'] }).locations).toEqual([{ city: 'San Francisco' }])
  })

  it('several places are OR-ed and deduped', () => {
    expect(norm({ locations: ['Denver', 'Miami', 'denver'] }).locations).toEqual([
      { city: 'Denver' },
      { city: 'Miami' },
    ])
  })

  it.each(['Oakland', 'London', 'Remote', 'Oregon', 'Austin, CA', 'Washington DC'])('%s → unsupported', (raw) => {
    const f = norm({ locations: [raw] })
    expect(f.locations).toBeUndefined()
    expect(notes(f)).toEqual([`location "${raw}" is not in the data`])
  })

  it('"the US" is every candidate: no constraint, not unsupported', () => {
    const f = norm({ locations: ['United States', 'Boston'] })
    expect(f.locations).toBeUndefined()
    expect(notes(f)).toEqual([])
  })
})

describe('skills', () => {
  it.each([
    ['golang', 'Go'],
    ['k8s', 'Kubernetes'],
    ['PostgreSQL', 'Postgres'],
    ['JS', 'JavaScript'],
    ['ts', 'TypeScript'],
    ['Rails', 'Ruby on Rails'],
    ['node', 'Node.js'],
    ['NodeJS', 'Node.js'],
    ['nextjs', 'Next.js'],
    ['ReactJS', 'React'],
    ['React.js', 'React'],
    ['vue.js', 'Vue'],
    ['Tailwind CSS', 'Tailwind'],
    ['ML', 'Machine Learning'],
    ['A/B tests', 'A/B Testing'],
    ['ab testing', 'A/B Testing'],
    ['Google Cloud', 'GCP'],
    ['Amazon Web Services', 'AWS'],
    ['CI CD', 'CI/CD'],
    ['LLM', 'LLMs'],
    ['react native', 'React Native'],
    ['IOS', 'iOS'],
    ['DBT', 'dbt'],
    ['grpc', 'gRPC'],
    ['a11y', 'Accessibility'],
  ])('%s → %s', (raw, skill) => {
    const f = norm({ skills_all: [raw] })
    expect(f.skills_all).toEqual([skill])
    expect(notes(f)).toEqual([])
  })

  it('React and React Native stay distinct', () => {
    expect(norm({ skills_all: ['React'] }).skills_all).toEqual(['React'])
    expect(norm({ skills_all: ['React Native'] }).skills_all).toEqual(['React Native'])
  })

  it('short skills match only as whole values', () => {
    expect(norm({ skills_all: ['Go'] }).skills_all).toEqual(['Go'])
    expect(norm({ skills_all: ['R'] }).skills_all).toEqual(['R'])
    expect(notes(norm({ skills_all: ['Gopher'] }))).toEqual(['skill "Gopher" is not in the data'])
  })

  it('"Machine Learning" is a skill; "machine learning engineer" is a role', () => {
    expect(norm({ skills_all: ['machine learning'] }).skills_all).toEqual(['Machine Learning'])
    expect(norm({ roles: ['machine learning engineer'] }).roles).toEqual(['Machine Learning Engineer'])
  })

  it('"Enterprise Sales" is a skill, distinct from the enterprise company type', () => {
    const f = norm({ skills_all: ['enterprise sales'] })
    expect(f.skills_all).toEqual(['Enterprise Sales'])
    expect(f.company_type).toBeUndefined()
  })

  it.each(['C++', 'C#', 'Angular', 'Excel', 'TF', 'Django'])('%s → unsupported', (raw) => {
    const f = norm({ skills_all: [raw] })
    expect(f.skills_all).toBeUndefined()
    expect(notes(f)).toEqual([`skill "${raw}" is not in the data`])
  })

  it('skills_any with one value becomes a required skill; overlap with skills_all is removed', () => {
    expect(norm({ skills_any: ['Swift'] })).toMatchObject({ skills_all: ['Swift'] })
    expect(norm({ skills_any: ['Swift'] }).skills_any).toBeUndefined()
    const f = norm({ skills_all: ['Go'], skills_any: ['Go', 'Rust', 'Java'] })
    expect(f.skills_all).toEqual(['Go'])
    expect(f.skills_any).toEqual(['Rust', 'Java'])
  })

  it('dedupes variants of the same skill', () => {
    expect(norm({ skills_all: ['Golang', 'Go', 'go'] }).skills_all).toEqual(['Go'])
  })
})

describe('companies and company type', () => {
  it('maps company names case-insensitively, keeps scope', () => {
    expect(norm({ companies: { names: ['globalcorp', 'Northwind AI'], scope: 'current' } }).companies).toEqual({
      names: ['Globalcorp', 'Northwind AI'],
      scope: 'current',
    })
  })

  it('unknown companies → unsupported', () => {
    const f = norm({ companies: { names: ['Google'], scope: 'any' } })
    expect(f.companies).toBeUndefined()
    expect(notes(f)).toEqual(['company "Google" is not in the data'])
  })

  it.each([
    ['startup', 'startup'],
    ['Startups', 'startup'],
    ['start-up', 'startup'],
    ['Enterprise', 'enterprise'],
    ['big company', 'enterprise'],
    ['corporate', 'enterprise'],
  ])('company type %s → %s', (raw, value) => {
    expect(norm({ company_type: { value: raw, scope: 'any' } }).company_type).toEqual({ value, scope: 'any' })
  })

  it.each(['FAANG', 'unicorn', 'Series A startup', 'fintech'])('company type %s → unsupported', (raw) => {
    const f = norm({ company_type: { value: raw, scope: 'any' } })
    expect(f.company_type).toBeUndefined()
    expect(notes(f)).toEqual([`company type "${raw}" is not in the data`])
  })
})

describe('education', () => {
  it.each([
    ['PhD', ['PhD']],
    ['Ph.D.', ['PhD']],
    ['doctorate', ['PhD']],
    ['M.S.', ['MS']],
    ['MSc', ['MS']],
    ["master's", ['MS', 'MBA']],
    ['masters', ['MS', 'MBA']],
    ['MBA', ['MBA']],
    ["bachelor's", ['BS', 'BA']],
    ['B.A.', ['BA']],
    ['advanced degree', ['MS', 'MBA', 'PhD']],
  ])('degree %s → %j', (raw, degrees) => {
    expect(norm({ degrees: [raw] }).degrees).toEqual(degrees)
  })

  it.each([
    ['Stanford', 'Stanford University'],
    ['Berkeley', 'UC Berkeley'],
    ['CMU', 'Carnegie Mellon University'],
    ['UW', 'University of Washington'],
    ['UIUC', 'University of Illinois'],
    ['UT Austin', 'University of Texas at Austin'],
    ['NYU', 'New York University'],
    ['Columbia', 'Columbia University'],
    ['Cornell', 'Cornell University'],
    ['UMich', 'University of Michigan'],
    ['Northeastern', 'Northeastern University'],
    ['georgia tech', 'Georgia Tech'],
    ['Massachusetts Institute of Technology', 'MIT'],
  ])('school %s → %s', (raw, school) => {
    expect(norm({ schools: [raw] }).schools).toEqual([school])
  })

  it.each(['Harvard', 'Wharton', 'Ivy League', 'a top school'])('school %s → unsupported', (raw) => {
    const f = norm({ schools: [raw] })
    expect(f.schools).toBeUndefined()
    expect(notes(f)).toEqual([`school "${raw}" is not in the data`])
  })

  it.each([
    ['CS', 'Computer Science'],
    ['EE', 'Electrical Engineering'],
    ['HCI', 'Human-Computer Interaction'],
    ['math', 'Mathematics'],
    ['stats', 'Statistics'],
    ['econ', 'Economics'],
  ])('field %s → %s', (raw, field) => {
    expect(norm({ fields_of_study: [raw] }).fields_of_study).toEqual([field])
  })

  it('unknown field → unsupported', () => {
    expect(notes(norm({ fields_of_study: ['Biology'] }))).toEqual(['field of study "Biology" is not in the data'])
  })
})

describe('mixed extractions', () => {
  it('maps everything it can and reports the rest — never drops silently', () => {
    const f = norm({
      roles: ['backend devs'],
      seniority: ['Sr.'],
      locations: ['NYC', 'Portland'],
      skills_all: ['golang', 'Haskell'],
      company_type: { value: 'startups', scope: 'any' },
      unsupported: ['speaks Spanish'],
    })
    expect(f).toMatchObject({
      roles: ['Backend Engineer'],
      seniority: ['senior'],
      locations: [{ city: 'New York' }],
      skills_all: ['Go'],
      company_type: { value: 'startup', scope: 'any' },
    })
    expect(notes(f)).toEqual([
      'location "Portland" is not in the data',
      'skill "Haskell" is not in the data',
      'speaks Spanish',
    ])
    expect(isSearchable(f)).toBe(false)
  })

  it('caps unsupported notes at 10 and truncates long values', () => {
    const f = norm({ skills_all: Array.from({ length: 15 }, (_, i) => `Lang${i}`) })
    expect(notes(f)).toHaveLength(10)
    const long = norm({ skills_all: ['x'.repeat(500)] })
    expect(notes(long)[0].length).toBeLessThanOrEqual(200)
  })

  it('output always passes the canonical schema (via parse) — open_to_work false is kept', () => {
    expect(norm({ open_to_work: false })).toEqual({ open_to_work: false, unsupported: [] })
  })
})
