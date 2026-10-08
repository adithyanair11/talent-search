import { describe, expect, it } from 'vitest'

import { EMPTY_EXTRACTION, isSearchable, type Extraction, type Filters } from '@/lib/schemas/filters'
import { CITIES, COMPANY_NAMES, DEGREES, FIELDS_OF_STUDY, ROLES, SCHOOLS, SKILLS } from '@/lib/vocabulary'

import { formatCorrection } from '@/lib/schemas/filters'

import {
  editDistance,
  ENGINEERING_ROLES,
  filtersToExtraction,
  isTypoCandidate,
  key,
  lookup,
  normalizeFilters,
  resolveFuzzy,
  TOO_VAGUE_NOTE,
} from './normalize'

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

describe('typo fallback', () => {
  it('edit distance counts adjacent transpositions as one edit', () => {
    expect(editDistance('pyhton', 'python', 2)).toBe(1)
    expect(editDistance('seatle', 'seattle', 2)).toBe(1)
    expect(editDistance('abc', 'xyz', 1)).toBe(2)
  })

  it('maps obvious misspellings to the one closest vocabulary value', () => {
    expect(norm({ skills_all: ['Pyhton', 'Kuberentes', 'Typscript'] }).skills_all).toEqual([
      'Python',
      'Kubernetes',
      'TypeScript',
    ])
    expect(norm({ locations: ['Seatle', 'Chicgo'] }).locations).toEqual([{ city: 'Seattle' }, { city: 'Chicago' }])
    expect(norm({ roles: ['data scientsts'] }).roles).toEqual(['Data Scientist'])
    expect(norm({ schools: ['Standford'] }).schools).toEqual(['Stanford University'])
    expect(notes(norm({ skills_all: ['Pyhton'], locations: ['Seatle'] }))).toEqual([])
  })

  it('short, unknown, qualified or first-letter-changed words never fuzzy-match', () => {
    // Short words stay exact: "Ga" is not Go, "Rist" is not Rust.
    expect(norm({ skills_all: ['Ga', 'Rist', 'C++', 'Angular'] }).skills_all).toBeUndefined()
    expect(norm({ locations: ['Washington DC'] }).locations).toBeUndefined()
    expect(norm({ roles: ['QA engineer'] }).roles).toBeUndefined()
    expect(norm({ locations: ['Houston'] }).locations).toBeUndefined()
  })

  it('the skill split runs before the role typo fallback ("Go engineer" is not an ML engineer)', () => {
    const f = norm({ roles: ['Go engineer'] })
    expect(f.roles).toEqual(ENGINEERING_ROLES)
    expect(f.skills_all).toEqual(['Go'])
  })
})

describe('typo corrections (guardrails)', () => {
  const corrections = (f: Filters) => (f.corrections ?? []).map(formatCorrection)

  it.each([
    ['skills_all', 'Andriod', { skills_all: ['Android'] }],
    ['skills_all', 'Pyhton', { skills_all: ['Python'] }],
    ['skills_all', 'Kubernets', { skills_all: ['Kubernetes'] }],
    ['locations', 'Nwe York', { locations: [{ city: 'New York' }] }],
  ] as const)('a misspelled %s value is corrected and shown: %s', (field, typo, expected) => {
    const f = norm({ [field]: [typo] })
    expect(f).toMatchObject(expected)
    expect(notes(f)).toEqual([])
    expect(corrections(f)).toHaveLength(1)
    expect(corrections(f)[0]).toMatch(new RegExp(`\\(corrected from ${typo}\\)$`))
  })

  it.each([
    ['Andriod', { skills_all: ['Android'] }, 'Android (corrected from Andriod)'],
    ['Pyhton', { skills_all: ['Python'] }, 'Python (corrected from Pyhton)'],
    ['Kubernets', { skills_all: ['Kubernetes'] }, 'Kubernetes (corrected from Kubernets)'],
    ['Nwe York', { locations: [{ city: 'New York' }] }, 'New York (corrected from Nwe York)'],
  ] as const)('a misspelling the model reported as unsupported is rescued: %s', (typo, expected, chip) => {
    const f = norm({ roles: ['Data Scientist'], unsupported: [typo] })
    expect(f).toMatchObject(expected)
    expect(notes(f)).toEqual([])
    expect(corrections(f)).toEqual([chip])
    expect(isSearchable(f)).toBe(true)
  })

  it('a correctly spelled value the model reported as unsupported is used, without a "corrected" note', () => {
    const f = norm({ roles: ['engineers'], skills_all: ['Flutter'], unsupported: ['Android'] })
    expect(f.roles).toEqual(['Mobile Engineer'])
    expect(notes(f)).toEqual([])
    expect(f.corrections).toBeUndefined()
    expect(norm({ roles: ['Recruiter'], unsupported: ['Seattle'] }).locations).toEqual([{ city: 'Seattle' }])
  })

  it('a rescued "<skill>" that names a role replaces the generic engineer group ("Andriod engineers")', () => {
    const f = norm({ roles: ['engineers'], skills_all: ['Kotlin'], unsupported: ['Andriod'] })
    expect(f.roles).toEqual(['Mobile Engineer'])
    expect(f.skills_all).toEqual(['Kotlin'])
    expect(corrections(f)).toEqual(['Android (corrected from Andriod)'])
    const devs = norm({ roles: ['engineers'], skills_all: ['Flutter'], unsupported: ['Andriod devs'] })
    expect(devs.roles).toEqual(['Mobile Engineer'])
    expect(notes(devs)).toEqual([])
    const asRole = norm({ roles: ['Andriod engineers'], skills_all: ['Kotlin'] })
    expect(asRole.roles).toEqual(['Mobile Engineer'])
    expect(asRole.skills_all).toEqual(['Kotlin'])
  })

  it('short words never fuzzy-match ("Rust" is not "Rest", "Ga" is not "Go")', () => {
    expect(norm({ skills_all: ['Rest'] }).skills_all).toBeUndefined()
    expect(notes(norm({ skills_all: ['Rest'] }))).toEqual(['skill "Rest" is not in the data'])
    for (const w of ['Rest', 'Ga', 'Jav', 'Kotl']) {
      expect(norm({ unsupported: [w] }).unsupported).toEqual([w])
    }
    expect(isTypoCandidate(key('Rest'))).toBe(false)
  })

  it('real English words and common non-vocabulary terms are never corrected', () => {
    for (const w of ['shift', 'spare', 'scale', 'stark', 'bland', 'NestJS']) {
      expect(isTypoCandidate(key(w))).toBe(false)
      const f = norm({ skills_all: [w], unsupported: [w] })
      expect(f.skills_all).toBeUndefined()
      expect(f.corrections).toBeUndefined()
    }
  })

  it('ambiguous matches stay unsupported', () => {
    const map = lookup(['Pandas', 'Pandaz'])
    expect(resolveFuzzy(map, 'Pandax')).toBeUndefined()
    expect(resolveFuzzy(map, 'Pnadas')).toEqual(['Pandas'])
  })

  it('genuinely unsupported requirements stay unsupported (and the search stays empty)', () => {
    for (const note of ['Antarctica', 'speaks Spanish', 'remote', 'visa sponsorship', 'FAANG', 'Go', 'Rust']) {
      const f = norm({ roles: ['Backend Engineer'], unsupported: [note] })
      expect(notes(f)).toEqual([note])
      expect(f.corrections).toBeUndefined()
      expect(isSearchable(f)).toBe(false)
    }
    // Longer phrases are requirements, not typos, even if a word in them is close to a value.
    expect(notes(norm({ unsupported: ['10 years of Pyhton'] }))).toEqual(['10 years of Pyhton'])
    expect(norm({ locations: ['Antarctica'] }).locations).toBeUndefined()
  })
})

describe('model commentary on hostile input', () => {
  it('drops notes about the input itself, keeps real requirements', () => {
    const f = norm({
      roles: ['Backend Engineer'],
      unsupported: ['SQL injection attempt in location field', 'malicious input ignored', 'attempted to override rules'],
    })
    expect(notes(f)).toEqual([])
    expect(isSearchable(f)).toBe(true)
    expect(notes(norm({ roles: ['Backend Engineer'], unsupported: ['SQL injection prevention'] }))).toEqual([
      'SQL injection prevention',
    ])
  })
})

describe('too vague', () => {
  it('only the generic engineer group → not searchable, with an explanation', () => {
    for (const raw of ['engineers', 'developers', 'software engineer']) {
      const f = norm({ roles: [raw] })
      expect(notes(f)).toEqual([TOO_VAGUE_NOTE])
      expect(isSearchable(f)).toBe(false)
    }
  })

  it('any concrete constraint or a specific role makes it a real search', () => {
    expect(isSearchable(norm({ roles: ['engineers'], locations: ['Denver'] }))).toBe(true)
    expect(isSearchable(norm({ roles: ['engineers'], open_to_work: false }))).toBe(true)
    expect(isSearchable(norm({ roles: ['Python developers'] }))).toBe(true)
    expect(isSearchable(norm({ roles: ['backend engineers'] }))).toBe(true)
    expect(isSearchable(norm({ roles: ['engineers', 'designers'] }))).toBe(true)
  })
})

describe('preferences', () => {
  it('vocabulary values are stored canonically so the ranking boost can match them', () => {
    const f = norm({ roles: ['Backend Engineer'], preferences: ['golang', 'k8s', 'Stanford', 'start-up', 'calm vibe'] })
    expect(f.preferences).toEqual(['Go', 'Kubernetes', 'Stanford University', 'startup', 'calm vibe'])
    expect(f.skills_all).toBeUndefined()
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

describe('filtersToExtraction (recruiter-edited filters)', () => {
  it('round-trips canonical filters unchanged through the same normalizer', () => {
    const filters = norm({
      roles: ['frontend developer'],
      seniority: ['sr'],
      years_experience: { min: 3, max: 9 },
      locations: ['NYC', 'Texas'],
      open_to_work: true,
      skills_all: ['React', 'ts'],
      skills_any: ['Go', 'Rust'],
      companies: { names: [COMPANY_NAMES[0]], scope: 'current' },
      company_type: { value: 'startup', scope: 'any' },
      degrees: ["master's"],
      schools: ['CMU'],
      fields_of_study: ['cs'],
      unsupported: ['speaks Japanese'],
      preferences: ['Kotlin'],
      interpretation: 'Senior frontend engineers.',
    })
    expect(normalizeFilters(filtersToExtraction(filters))).toEqual(filters)
  })

  it('re-applies normalization rules to edited filters', () => {
    expect(normalizeFilters(filtersToExtraction({ skills_any: ['Go'] }))).toEqual({ skills_all: ['Go'], unsupported: [] })
  })
})
