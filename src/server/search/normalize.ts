import 'server-only'

import {
  filtersSchema,
  MAX_YEARS,
  type Extraction,
  type Filters,
} from '@/lib/schemas/filters'
import {
  CITIES,
  COMPANY_NAMES,
  COMPANY_TYPES,
  FIELDS_OF_STUDY,
  ROLES,
  SCHOOLS,
  SENIORITIES,
  SKILLS,
  STATES,
  type City,
  type Company,
  type CompanyType,
  type Degree,
  type FieldOfStudy,
  type Role,
  type School,
  type Seniority,
  type Skill,
  type State,
} from '@/lib/vocabulary'

/**
 * Maps the LLM's free-text extraction onto the exact data vocabulary (docs/data-notes.md §2, §4).
 * Every raw value either lands in a canonical filter or becomes an `unsupported` note — nothing is dropped
 * silently, and nothing outside the vocabulary reaches the query. Alias tables are general synonyms, never
 * rules for specific briefs.
 */

/** Lookup key: lower-case, accents and separators removed. Keeps `+` and `#` so "C++" never becomes "C". */
export function key(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9+#]/g, '')
}

type Lookup<T> = ReadonlyMap<string, readonly T[]>

/** Canonical values map to themselves; aliases add more keys. A key may expand to several values. */
function lookup<T extends string>(
  canonical: readonly T[],
  aliases: Record<string, T | readonly T[]> = {},
): Lookup<T> {
  const map = new Map<string, readonly T[]>()
  for (const value of canonical) map.set(key(value), [value])
  for (const [alias, target] of Object.entries(aliases)) {
    map.set(key(alias), typeof target === 'string' ? [target as T] : (target as readonly T[]))
  }
  return map
}

/** Exact key first, then the singular (a trailing "s" dropped) so "engineers" / "startups" match. */
function resolve<T>(map: Lookup<T>, value: string): readonly T[] | undefined {
  const k = key(value)
  if (!k) return undefined
  return map.get(k) ?? (k.length > 2 && k.endsWith('s') ? map.get(k.slice(0, -1)) : undefined)
}

// ---------------------------------------------------------------------------------------------------------
// Vocabulary + aliases
// ---------------------------------------------------------------------------------------------------------

/** Every role whose title is "… Engineer": what a generic "engineer" / "developer" means. */
export const ENGINEERING_ROLES: readonly Role[] = ROLES.filter((r) => r.endsWith(' Engineer'))

const ROLE_LOOKUP = lookup<Role>(ROLES, {
  frontend: 'Frontend Engineer',
  'frontend developer': 'Frontend Engineer',
  'frontend dev': 'Frontend Engineer',
  'ui engineer': 'Frontend Engineer',
  'ui developer': 'Frontend Engineer',
  fullstack: 'Full Stack Engineer',
  'fullstack developer': 'Full Stack Engineer',
  'fullstack dev': 'Full Stack Engineer',
  backend: 'Backend Engineer',
  'backend developer': 'Backend Engineer',
  'backend dev': 'Backend Engineer',
  designer: 'Product Designer',
  'ux designer': 'Product Designer',
  'ui designer': 'Product Designer',
  'ui/ux designer': 'Product Designer',
  'ux/ui designer': 'Product Designer',
  'product design': 'Product Designer',
  pm: 'Product Manager',
  'product management': 'Product Manager',
  'data engineering': 'Data Engineer',
  'data science': 'Data Scientist',
  'ml engineer': 'Machine Learning Engineer',
  mle: 'Machine Learning Engineer',
  'machine learning engineering': 'Machine Learning Engineer',
  'mobile developer': 'Mobile Engineer',
  'mobile dev': 'Mobile Engineer',
  'ios engineer': 'Mobile Engineer',
  'ios developer': 'Mobile Engineer',
  'android engineer': 'Mobile Engineer',
  'android developer': 'Mobile Engineer',
  ae: 'Account Executive',
  'sales rep': 'Account Executive',
  'sales representative': 'Account Executive',
  'sales executive': 'Account Executive',
  devops: 'DevOps Engineer',
  sre: 'DevOps Engineer',
  'site reliability engineer': 'DevOps Engineer',
  'platform engineer': 'DevOps Engineer',
  'infrastructure engineer': 'DevOps Engineer',
  'infra engineer': 'DevOps Engineer',
  marketer: 'Marketing Manager',
  'talent partner': 'Recruiter',
  'talent acquisition': 'Recruiter',
  'technical recruiter': 'Recruiter',
  engineer: ENGINEERING_ROLES,
  developer: ENGINEERING_ROLES,
  dev: ENGINEERING_ROLES,
  'software engineer': ENGINEERING_ROLES,
  'software developer': ENGINEERING_ROLES,
  swe: ENGINEERING_ROLES,
  programmer: ENGINEERING_ROLES,
})

const SENIORITY_LOOKUP = lookup<Seniority>(SENIORITIES, {
  jr: 'junior',
  'entry level': 'junior',
  'new grad': 'junior',
  'mid level': 'mid',
  intermediate: 'mid',
  sr: 'senior',
})

const CITY_LOOKUP = lookup<City>(
  CITIES.map((c) => c.city),
  {
    nyc: 'New York',
    'new york city': 'New York',
    manhattan: 'New York',
    sf: 'San Francisco',
    'san fran': 'San Francisco',
    'bay area': 'San Francisco',
    'sf bay area': 'San Francisco',
    'san francisco bay area': 'San Francisco',
    la: 'Los Angeles',
  },
)

const STATE_LOOKUP = lookup<State>(STATES, {
  'new york state': 'NY',
  california: 'CA',
  washington: 'WA',
  'washington state': 'WA',
  illinois: 'IL',
  texas: 'TX',
  massachusetts: 'MA',
  colorado: 'CO',
  georgia: 'GA',
  florida: 'FL',
})

/** Every candidate is in the US, so these places constrain nothing (they are neither filters nor unsupported). */
const WHOLE_DATASET_PLACES = new Set(['us', 'usa', 'unitedstates', 'unitedstatesofamerica', 'america'].map(key))

const SKILL_LOOKUP = lookup<Skill>(SKILLS, {
  golang: 'Go',
  k8s: 'Kubernetes',
  kube: 'Kubernetes',
  postgresql: 'Postgres',
  psql: 'Postgres',
  js: 'JavaScript',
  ecmascript: 'JavaScript',
  ts: 'TypeScript',
  rails: 'Ruby on Rails',
  ror: 'Ruby on Rails',
  node: 'Node.js',
  next: 'Next.js',
  reactjs: 'React',
  'react.js': 'React',
  vuejs: 'Vue',
  'vue.js': 'Vue',
  'tailwind css': 'Tailwind',
  ml: 'Machine Learning',
  'a/b tests': 'A/B Testing',
  'a/b test': 'A/B Testing',
  'ab testing': 'A/B Testing',
  'split testing': 'A/B Testing',
  'google cloud': 'GCP',
  'google cloud platform': 'GCP',
  'amazon web services': 'AWS',
  'continuous integration': 'CI/CD',
  llm: 'LLMs',
  'large language models': 'LLMs',
  'apache spark': 'Spark',
  'apache kafka': 'Kafka',
  'apache airflow': 'Airflow',
  sfdc: 'Salesforce',
  a11y: 'Accessibility',
  'ux research': 'User Research',
  'design system': 'Design Systems',
  stats: 'Statistics',
})

const COMPANY_LOOKUP = lookup<Company>(COMPANY_NAMES)

const COMPANY_TYPE_LOOKUP = lookup<CompanyType>(COMPANY_TYPES, {
  'start-up': 'startup',
  'big company': 'enterprise',
  'large company': 'enterprise',
  'big corporation': 'enterprise',
  corporate: 'enterprise',
  corporation: 'enterprise',
  'big corp': 'enterprise',
})

const DEGREE_LOOKUP = lookup<Degree>(['BS', 'BA', 'MS', 'MBA', 'PhD'], {
  doctorate: 'PhD',
  doctoral: 'PhD',
  'doctoral degree': 'PhD',
  msc: 'MS',
  'master of science': 'MS',
  "master's": ['MS', 'MBA'],
  'masters degree': ['MS', 'MBA'],
  master: ['MS', 'MBA'],
  bsc: 'BS',
  'bachelor of science': 'BS',
  'bachelor of arts': 'BA',
  "bachelor's": ['BS', 'BA'],
  'bachelors degree': ['BS', 'BA'],
  bachelor: ['BS', 'BA'],
  'graduate degree': ['MS', 'MBA', 'PhD'],
  'advanced degree': ['MS', 'MBA', 'PhD'],
  postgraduate: ['MS', 'MBA', 'PhD'],
})

const SCHOOL_LOOKUP = lookup<School>(SCHOOLS, {
  stanford: 'Stanford University',
  berkeley: 'UC Berkeley',
  'uc berkeley': 'UC Berkeley',
  'university of california berkeley': 'UC Berkeley',
  cal: 'UC Berkeley',
  cmu: 'Carnegie Mellon University',
  'carnegie mellon': 'Carnegie Mellon University',
  uw: 'University of Washington',
  'uw seattle': 'University of Washington',
  uiuc: 'University of Illinois',
  'university of illinois urbana-champaign': 'University of Illinois',
  'ut austin': 'University of Texas at Austin',
  'university of texas': 'University of Texas at Austin',
  nyu: 'New York University',
  columbia: 'Columbia University',
  cornell: 'Cornell University',
  michigan: 'University of Michigan',
  umich: 'University of Michigan',
  northeastern: 'Northeastern University',
  'georgia institute of technology': 'Georgia Tech',
  gatech: 'Georgia Tech',
  'massachusetts institute of technology': 'MIT',
})

const FIELD_LOOKUP = lookup<FieldOfStudy>(FIELDS_OF_STUDY, {
  cs: 'Computer Science',
  compsci: 'Computer Science',
  ee: 'Electrical Engineering',
  ce: 'Computer Engineering',
  hci: 'Human-Computer Interaction',
  math: 'Mathematics',
  maths: 'Mathematics',
  stats: 'Statistics',
  econ: 'Economics',
  psych: 'Psychology',
  comms: 'Communications',
  'business administration': 'Business',
})

// ---------------------------------------------------------------------------------------------------------
// Normalization
// ---------------------------------------------------------------------------------------------------------

const MAX_NOTE = 200
const MAX_NOTES = 10
const MAX_LIST = 20

function clip(text: string, max: number): string {
  const t = text.trim().replace(/\s+/g, ' ')
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`
}

class Collector {
  readonly notes: string[] = []

  unsupported(kind: string, value: string): void {
    this.note(`${kind} "${clip(value, 80)}" is not in the data`)
  }

  note(text: string): void {
    const t = clip(text, MAX_NOTE)
    if (t && !this.notes.some((n) => n.toLowerCase() === t.toLowerCase())) this.notes.push(t)
  }
}

function uniq<T>(values: readonly T[]): T[] {
  return [...new Set(values)].slice(0, MAX_LIST)
}

function cleanStrings(values: readonly string[] | null): string[] {
  return (values ?? []).map((v) => v.trim()).filter(Boolean)
}

/** Resolve each value; unknown values become notes. Returns undefined when nothing mapped. */
function mapList<T>(
  values: readonly string[] | null,
  map: Lookup<T>,
  kind: string,
  out: Collector,
): T[] | undefined {
  const result: T[] = []
  for (const value of cleanStrings(values)) {
    const hit = resolve(map, value)
    if (hit) result.push(...hit)
    else out.unsupported(kind, value)
  }
  return result.length ? uniq(result) : undefined
}

/**
 * "<skill> engineer/developer" (e.g. "Golang developer") → the engineering roles plus that skill. Only used
 * when the phrase is not itself a role alias ("iOS engineer" is a Mobile Engineer).
 */
const SKILL_ROLE_SUFFIXES = ['engineers', 'engineer', 'developers', 'developer', 'devs', 'dev']

function splitSkillRole(value: string): Skill[] | undefined {
  const words = value.trim().split(/\s+/)
  if (words.length < 2) return undefined
  const last = words[words.length - 1].toLowerCase()
  if (!SKILL_ROLE_SUFFIXES.includes(last)) return undefined
  return resolve(SKILL_LOOKUP, words.slice(0, -1).join(' '))?.slice()
}

function normalizeRoles(
  values: readonly string[] | null,
  out: Collector,
): { roles?: Role[]; skills: Skill[] } {
  const roles: Role[] = []
  const skills: Skill[] = []
  for (const value of cleanStrings(values)) {
    const hit = resolve(ROLE_LOOKUP, value)
    if (hit) {
      roles.push(...hit)
      continue
    }
    const skill = splitSkillRole(value)
    if (skill) {
      roles.push(...ENGINEERING_ROLES)
      skills.push(...skill)
      continue
    }
    out.unsupported('role', value)
  }
  return { roles: roles.length ? uniq(roles) : undefined, skills }
}

type Location = NonNullable<Filters['locations']>[number]

function resolveLocation(place: string): Location | 'everywhere' | undefined {
  if (WHOLE_DATASET_PLACES.has(key(place))) return 'everywhere'
  const city = resolve(CITY_LOOKUP, place)
  if (city) return { city: city[0] }
  const state = resolve(STATE_LOOKUP, place)
  if (state) return { state: state[0] }
  // "Austin, TX" / "Seattle, WA, USA": the city decides; a trailing state/country must agree with it.
  const parts = place.split(',').map((p) => p.trim()).filter(Boolean)
  if (parts.length > 1) {
    const head = resolve(CITY_LOOKUP, parts[0])?.[0]
    if (!head) return undefined
    const stateOfCity = CITIES.find((c) => c.city === head)?.state
    const consistent = parts.slice(1).every((p) => {
      if (WHOLE_DATASET_PLACES.has(key(p))) return true
      return resolve(STATE_LOOKUP, p)?.[0] === stateOfCity
    })
    return consistent ? { city: head } : undefined
  }
  return undefined
}

function normalizeLocations(values: readonly string[] | null, out: Collector): Location[] | undefined {
  const result: Location[] = []
  let everywhere = false
  for (const value of cleanStrings(values)) {
    const hit = resolveLocation(value)
    if (hit === 'everywhere') everywhere = true
    else if (hit) result.push(hit)
    else out.unsupported('location', value)
  }
  // "In the US or Boston" is everyone in the data — no location constraint at all.
  if (everywhere) return undefined
  const seen = new Set<string>()
  const deduped = result.filter((l) => {
    const k = 'city' in l ? `c:${l.city}` : `s:${l.state}`
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
  return deduped.length ? deduped.slice(0, MAX_LIST) : undefined
}

function normalizeYears(
  range: Extraction['years_experience'],
  out: Collector,
): Filters['years_experience'] {
  if (!range) return undefined
  const { min, max } = range
  if (min === null && max === null) return undefined
  const bad = (n: number | null) => n !== null && (n < 0 || n > MAX_YEARS)
  if (bad(min) || bad(max) || (min !== null && max !== null && min > max)) {
    out.note(`years of experience ${min ?? ''}–${max ?? ''} is not a valid range`)
    return undefined
  }
  return { ...(min !== null && min > 0 && { min }), ...(max !== null && { max }) }
}

/** Map an LLM extraction onto canonical filters. Pure and deterministic. */
export function normalizeFilters(raw: Extraction): Filters {
  const out = new Collector()

  const { roles, skills: roleSkills } = normalizeRoles(raw.roles, out)
  const seniority = mapList(raw.seniority, SENIORITY_LOOKUP, 'level', out)
  const locations = normalizeLocations(raw.locations, out)

  const skillsAll = uniq([...(mapList(raw.skills_all, SKILL_LOOKUP, 'skill', out) ?? []), ...roleSkills])
  let skillsAny = (mapList(raw.skills_any, SKILL_LOOKUP, 'skill', out) ?? []).filter(
    (s) => !skillsAll.includes(s),
  )
  // "Any of one skill" is the same as requiring it.
  if (skillsAny.length === 1) {
    skillsAll.push(skillsAny[0])
    skillsAny = []
  }

  let companies: Filters['companies']
  if (raw.companies) {
    const names = mapList(raw.companies.names, COMPANY_LOOKUP, 'company', out)
    if (names) companies = { names, scope: raw.companies.scope }
  }

  let companyType: Filters['company_type']
  if (raw.company_type && raw.company_type.value.trim()) {
    const value = resolve(COMPANY_TYPE_LOOKUP, raw.company_type.value)
    if (value) companyType = { value: value[0], scope: raw.company_type.scope }
    else out.unsupported('company type', raw.company_type.value)
  }

  const degrees = mapList(raw.degrees, DEGREE_LOOKUP, 'degree', out)
  const schools = mapList(raw.schools, SCHOOL_LOOKUP, 'school', out)
  const fields = mapList(raw.fields_of_study, FIELD_LOOKUP, 'field of study', out)
  const years = normalizeYears(raw.years_experience, out)

  for (const note of raw.unsupported) out.note(note)
  const preferences = uniq(raw.preferences.map((p) => clip(p, MAX_NOTE)).filter(Boolean)).slice(0, MAX_NOTES)

  const interpretation = clip(raw.interpretation, 300)

  return filtersSchema.parse({
    ...(roles && { roles }),
    ...(seniority && { seniority }),
    ...(years && Object.keys(years).length > 0 && { years_experience: years }),
    ...(locations && { locations }),
    ...(raw.open_to_work !== null && { open_to_work: raw.open_to_work }),
    ...(skillsAll.length > 0 && { skills_all: skillsAll.slice(0, MAX_LIST) }),
    ...(skillsAny.length > 0 && { skills_any: skillsAny }),
    ...(companies && { companies }),
    ...(companyType && { company_type: companyType }),
    ...(degrees && { degrees }),
    ...(schools && { schools }),
    ...(fields && { fields_of_study: fields }),
    unsupported: out.notes.slice(0, MAX_NOTES),
    ...(preferences.length > 0 && { preferences }),
    ...(interpretation && { interpretation }),
  })
}

/**
 * Canonical filters back into extraction form, so recruiter-edited filters run through exactly the same
 * normalization as the model's output (`normalizeFilters(filtersToExtraction(f))`).
 */
export function filtersToExtraction(filters: Filters): Extraction {
  return {
    roles: filters.roles ?? null,
    seniority: filters.seniority ?? null,
    years_experience: filters.years_experience
      ? { min: filters.years_experience.min ?? null, max: filters.years_experience.max ?? null }
      : null,
    locations: filters.locations?.map((l) => ('city' in l ? l.city : l.state)) ?? null,
    open_to_work: filters.open_to_work ?? null,
    skills_all: filters.skills_all ?? null,
    skills_any: filters.skills_any ?? null,
    companies: filters.companies ? { names: filters.companies.names, scope: filters.companies.scope } : null,
    company_type: filters.company_type
      ? { value: filters.company_type.value, scope: filters.company_type.scope }
      : null,
    degrees: filters.degrees ?? null,
    schools: filters.schools ?? null,
    fields_of_study: filters.fields_of_study ?? null,
    unsupported: filters.unsupported ?? [],
    preferences: filters.preferences ?? [],
    interpretation: filters.interpretation ?? '',
  }
}
