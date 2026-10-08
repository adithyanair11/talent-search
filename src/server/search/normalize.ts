import 'server-only'

import {
  filtersSchema,
  MAX_YEARS,
  type Correction,
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

import { TOO_VAGUE_NOTE, unsupportedNote, type UnsupportedKind } from '@/lib/unsupported'

import { NOT_TYPOS } from './not-typos'

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
export function lookup<T extends string>(
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
function resolveExact<T>(map: Lookup<T>, value: string): readonly T[] | undefined {
  const k = key(value)
  if (!k) return undefined
  return map.get(k) ?? (k.length > 2 && k.endsWith('s') ? map.get(k.slice(0, -1)) : undefined)
}

/** Optimal-string-alignment distance (Levenshtein + adjacent transposition), stopping early above `max`. */
export function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1
  let prev2: number[] = []
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    const row = [i]
    let best = i
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      let d = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d = Math.min(d, prev2[j - 2] + 1)
      row.push(d)
      best = Math.min(best, d)
    }
    if (best > max) return max + 1
    prev2 = prev
    prev = row
  }
  return prev[b.length]
}

/** Edits a typo may have: none under 5 characters (Go, R, Java, Rust, TS stay exact), 1 from 5, 2 from 9. */
export function typoBudget(length: number): number {
  return length >= 9 ? 2 : length >= 5 ? 1 : 0
}

/** Same values in the same order. */
function sameTarget<T>(a: readonly T[], b: readonly T[]): boolean {
  return a.length === b.length && a.every((t, i) => t === b[i])
}

/**
 * Can `k` be a typo at all? At least 5 characters, and not a real English word or common term that merely
 * looks like a vocabulary value ("shift" is not "Swift", "spare" is not "Spark") — see not-typos.ts.
 */
export function isTypoCandidate(k: string): boolean {
  return k.length >= 5 && !NOT_TYPOS.has(k)
}

type FuzzyHit<T> = { target: readonly T[]; distance: number; ambiguous: boolean }

/**
 * The closest key of `map` within the typo budget of both words, with distance ≥ 1. Typos keep the first
 * letter, so a different first letter is a different word ("QA engineer" is not an "ML engineer"), and a key
 * that contains the other is a qualified value, not a typo ("Washington DC" is not "Washington"). `ambiguous`
 * when two keys at the best distance mean different things.
 */
function fuzzyMatch<T>(map: Lookup<T>, k: string): FuzzyHit<T> | undefined {
  if (!isTypoCandidate(k)) return undefined
  let hit: FuzzyHit<T> | undefined
  for (const [candidate, target] of map) {
    const budget = Math.min(typoBudget(k.length), typoBudget(candidate.length))
    if (budget === 0 || candidate[0] !== k[0] || candidate.includes(k) || k.includes(candidate)) continue
    const distance = editDistance(k, candidate, budget)
    if (distance > budget || (hit && distance > hit.distance)) continue
    if (!hit || distance < hit.distance) hit = { target, distance, ambiguous: false }
    else if (!sameTarget(hit.target, target)) hit.ambiguous = true
  }
  return hit
}

/** Typo fallback ("Pyhton", "Seatle"): the unambiguous closest value, or undefined. */
export function resolveFuzzy<T>(map: Lookup<T>, value: string): readonly T[] | undefined {
  const hit = fuzzyMatch(map, key(value))
  return hit && !hit.ambiguous ? hit.target : undefined
}

/** Exact, then typo fallback. A typo correction is recorded on `out` so the recruiter can see it. */
function resolve<T extends string>(map: Lookup<T>, value: string, out?: Collector): readonly T[] | undefined {
  const exact = resolveExact(map, value)
  if (exact) return exact
  const fuzzy = resolveFuzzy(map, value)
  if (fuzzy) out?.corrected(value, fuzzy)
  return fuzzy
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
  'ios dev': 'Mobile Engineer',
  'android engineer': 'Mobile Engineer',
  'android developer': 'Mobile Engineer',
  'android dev': 'Mobile Engineer',
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

export { TOO_VAGUE_NOTE }

/** Preferences that name a vocabulary value are stored canonically, so the ranking boost can match them. */
const PREFERENCE_LOOKUPS: readonly Lookup<string>[] = [
  SKILL_LOOKUP,
  SCHOOL_LOOKUP,
  FIELD_LOOKUP,
  COMPANY_LOOKUP,
  COMPANY_TYPE_LOOKUP,
  DEGREE_LOOKUP,
]

const MAX_NOTE = 200
const MAX_NOTES = 10
const MAX_LIST = 20

function clip(text: string, max: number): string {
  const t = text.trim().replace(/\s+/g, ' ')
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`
}

/** The filter fields a raw value can be written to (the kinds named in unsupported notes). */
type FieldKind = UnsupportedKind

class Collector {
  readonly notes: string[] = []
  readonly corrections: Correction[] = []
  /** Values that matched nothing in their own field; reconciled against the other fields before becoming notes. */
  readonly unmatched: { kind: FieldKind; value: string }[] = []

  /** A misspelled value that was mapped to `to` — shown to the recruiter, e.g. "Android (corrected from Andriod)". */
  corrected(from: string, to: readonly string[]): void {
    const label = to === ENGINEERING_ROLES ? 'engineer' : to.join(' or ')
    const c = { from: clip(from, 80), to: clip(label, 80) }
    if (!this.corrections.some((x) => x.from === c.from && x.to === c.to)) this.corrections.push(c)
  }

  unsupported(kind: FieldKind, value: string): void {
    this.note(unsupportedNote(kind, clip(value, 80)))
  }

  unknown(kind: FieldKind, value: string): void {
    this.unmatched.push({ kind, value })
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
function mapList<T extends string>(
  values: readonly string[] | null,
  map: Lookup<T>,
  kind: FieldKind,
  out: Collector,
): T[] | undefined {
  const result: T[] = []
  for (const value of cleanStrings(values)) {
    const hit = resolve(map, value, out)
    if (hit) result.push(...hit)
    else out.unknown(kind, value)
  }
  return result.length ? uniq(result) : undefined
}

/**
 * "<skill> engineer/developer" (e.g. "Golang developer") → the engineering roles plus that skill. Only used
 * when the phrase is not itself a role alias ("iOS engineer" is a Mobile Engineer).
 */
const SKILL_ROLE_SUFFIXES = ['engineers', 'engineer', 'developers', 'developer', 'devs', 'dev']

function splitSkillRole(value: string, typo: { out: Collector } | undefined): Skill[] | undefined {
  const words = value.trim().split(/\s+/)
  if (words.length < 2) return undefined
  const last = words[words.length - 1].toLowerCase()
  if (!SKILL_ROLE_SUFFIXES.includes(last)) return undefined
  const skill = words.slice(0, -1).join(' ')
  if (!typo) return resolveExact(SKILL_LOOKUP, skill)?.slice()
  const fuzzy = resolveFuzzy(SKILL_LOOKUP, skill)
  if (fuzzy) typo.out.corrected(skill, fuzzy)
  return fuzzy?.slice()
}

function normalizeRoles(
  values: readonly string[] | null,
  out: Collector,
): { roles?: Role[]; skills: Skill[]; generic: boolean } {
  const roles: Role[] = []
  const skills: Skill[] = []
  let specific = false
  for (const value of cleanStrings(values)) {
    // Exact role, exact "<skill> engineer", then typos in the same order: the skill split runs before the role
    // typo fallback so "Go engineer" never fuzzes into "ML engineer", and a misspelled role alias wins over a
    // misspelled skill ("Andriod engineer" is a Mobile Engineer, like "Android engineer").
    const exact = resolveExact(ROLE_LOOKUP, value)
    const exactSkill = exact ? undefined : splitSkillRole(value, undefined)
    const fuzzyRole = exact || exactSkill ? undefined : resolveFuzzy(ROLE_LOOKUP, value)
    if (fuzzyRole) out.corrected(value, fuzzyRole)
    const hit = exact ?? fuzzyRole
    const skill = exactSkill ?? (hit ? undefined : splitSkillRole(value, { out }))
    if (hit) {
      roles.push(...hit)
      // The generic alias targets are the ENGINEERING_ROLES array itself.
      if (hit !== ENGINEERING_ROLES) specific = true
      continue
    }
    if (skill) {
      roles.push(...ENGINEERING_ROLES)
      skills.push(...skill)
      specific = true
      continue
    }
    out.unknown('role', value)
  }
  return { roles: roles.length ? uniq(roles) : undefined, skills, generic: roles.length > 0 && !specific }
}

type Location = NonNullable<Filters['locations']>[number]

function resolveLocation(place: string, out: Collector): Location | 'everywhere' | undefined {
  if (WHOLE_DATASET_PLACES.has(key(place))) return 'everywhere'
  const city = resolveExact(CITY_LOOKUP, place)
  if (city) return { city: city[0] }
  const state = resolveExact(STATE_LOOKUP, place)
  if (state) return { state: state[0] }
  const cityTypo = resolve(CITY_LOOKUP, place, out)
  if (cityTypo) return { city: cityTypo[0] }
  const stateTypo = resolve(STATE_LOOKUP, place, out)
  if (stateTypo) return { state: stateTypo[0] }
  // "Austin, TX" / "Seattle, WA, USA": the city decides; a trailing state/country must agree with it.
  const parts = place.split(',').map((p) => p.trim()).filter(Boolean)
  if (parts.length > 1) {
    const head = resolve(CITY_LOOKUP, parts[0], out)?.[0]
    if (!head) return undefined
    const stateOfCity = CITIES.find((c) => c.city === head)?.state
    const consistent = parts.slice(1).every((p) => {
      if (WHOLE_DATASET_PLACES.has(key(p))) return true
      return resolve(STATE_LOOKUP, p, out)?.[0] === stateOfCity
    })
    return consistent ? { city: head } : undefined
  }
  return undefined
}

function normalizeLocations(values: readonly string[] | null, out: Collector): Location[] | undefined {
  const result: Location[] = []
  let everywhere = false
  for (const value of cleanStrings(values)) {
    const hit = resolveLocation(value, out)
    if (hit === 'everywhere') everywhere = true
    else if (hit) result.push(hit)
    else out.unknown('location', value)
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

/**
 * The model sometimes comments on a hostile brief in `unsupported` ("SQL injection attempt in location field")
 * although the prompt says not to. Such a note is about the input, not a requirement, so it is dropped. Only
 * commentary-shaped phrases match; a requirement such as "SQL injection prevention" is kept.
 */
const INPUT_COMMENTARY =
  /\b(injection|malicious|suspicious|hostile|manipulation)\b.*\b(attempts?|attempted|input|text|code|content|fragments?|detected|ignored|removed)\b|\b(attempts?|attempted|tried|trying) to (inject|manipulate|override|bypass)\b/i

type Rescue =
  | { kind: 'skill'; target: readonly Skill[] }
  | { kind: 'city'; target: readonly City[] }
  | { kind: 'state'; target: readonly State[] }
  | { kind: 'role'; target: readonly Role[] }

/** Where a model-reported `unsupported` item may be rescued to: skills, places and roles only. */
const RESCUE_LOOKUPS = [
  { kind: 'skill', map: SKILL_LOOKUP },
  { kind: 'city', map: CITY_LOOKUP },
  { kind: 'state', map: STATE_LOOKUP },
  { kind: 'role', map: ROLE_LOOKUP },
] as const

/**
 * The model sometimes reports a value as unsupported instead of putting it in its field — misspelled ("Andriod")
 * or already corrected ("Android"). Such an item is rescued only when it is one or two words, is a typo candidate
 * (≥ 5 characters, not an English word or known non-vocabulary term), and has exactly one match across all of
 * skills, places and roles: an exact value, or else the closest within the typo budget. Anything else stays
 * unsupported. `exact` rescues are not typos, so they are not shown as corrections.
 */
function rescueTypo(note: string): (Rescue & { exact: boolean }) | undefined {
  if (note.trim().split(/\s+/).length > 2) return undefined
  const k = key(note)
  if (!isTypoCandidate(k)) return undefined
  const exact = RESCUE_LOOKUPS.flatMap(({ kind, map }) => {
    const target = resolveExact<string>(map, note)
    return target ? [{ kind, target, exact: true }] : []
  })
  if (exact.length > 1) return undefined
  if (exact.length === 1) return exact[0] as Rescue & { exact: boolean }
  let best: (Rescue & { distance: number }) | undefined
  let ambiguous = false
  for (const { kind, map } of RESCUE_LOOKUPS) {
    const hit = fuzzyMatch<string>(map, k)
    if (!hit) continue
    if (!best || hit.distance < best.distance) {
      best = { kind, target: hit.target, distance: hit.distance } as Rescue & { distance: number }
      ambiguous = hit.ambiguous
    } else if (hit.distance === best.distance) {
      ambiguous ||= hit.ambiguous || kind !== best.kind || !sameTarget<string>(hit.target, best.target)
    }
  }
  return best && !ambiguous ? { ...best, exact: false } : undefined
}

type FieldHit =
  | { kind: 'skill'; target: readonly Skill[] }
  | { kind: 'role'; target: readonly Role[] }
  | { kind: 'city'; target: readonly City[] }
  | { kind: 'state'; target: readonly State[] }
  | { kind: 'company'; target: readonly Company[] }
  | { kind: 'company type'; target: readonly CompanyType[] }
  | { kind: 'degree'; target: readonly Degree[] }
  | { kind: 'school'; target: readonly School[] }
  | { kind: 'field of study'; target: readonly FieldOfStudy[] }
  | { kind: 'level'; target: readonly Seniority[] }

/** Every field's vocabulary, for values the model wrote into the wrong field. `field` is the FieldKind it fills. */
const FIELD_LOOKUPS = [
  { kind: 'skill', field: 'skill', map: SKILL_LOOKUP },
  { kind: 'role', field: 'role', map: ROLE_LOOKUP },
  { kind: 'city', field: 'location', map: CITY_LOOKUP },
  { kind: 'state', field: 'location', map: STATE_LOOKUP },
  { kind: 'company', field: 'company', map: COMPANY_LOOKUP },
  { kind: 'company type', field: 'company type', map: COMPANY_TYPE_LOOKUP },
  { kind: 'degree', field: 'degree', map: DEGREE_LOOKUP },
  { kind: 'school', field: 'school', map: SCHOOL_LOOKUP },
  { kind: 'field of study', field: 'field of study', map: FIELD_LOOKUP },
  { kind: 'level', field: 'level', map: SENIORITY_LOOKUP },
] as const

/**
 * Exact (or alias) matches of `value` in every field's vocabulary except `own`. No typo matching across fields:
 * a value that is not exactly some other field's value stays where the model put it.
 */
function otherFieldHits(value: string, own: FieldKind | undefined): FieldHit[] {
  return FIELD_LOOKUPS.flatMap(({ kind, field, map }) => {
    if (field === own) return []
    const target = resolveExact<string>(map, value)
    return target ? [{ kind, target } as FieldHit] : []
  })
}

/**
 * Below this key length a value is only dropped as a duplicate, never moved: two-letter values are too
 * ambiguous across fields ("MA" is a degree to some and a state code to the data).
 */
const MIN_MOVE_KEY = 3

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

  const normalizedRoles = normalizeRoles(raw.roles, out)
  let { roles, generic: genericRoles } = normalizedRoles
  let seniority = mapList(raw.seniority, SENIORITY_LOOKUP, 'level', out)
  let locations = normalizeLocations(raw.locations, out)

  const skillsAll = uniq([...(mapList(raw.skills_all, SKILL_LOOKUP, 'skill', out) ?? []), ...normalizedRoles.skills])

  // Misspelled values the model reported as unsupported become real filters (and a visible correction).
  const notes: string[] = []
  for (const note of cleanStrings(raw.unsupported)) {
    if (INPUT_COMMENTARY.test(note)) continue
    // A split job title: "Terraform platform engineers" → roles ["engineer"] + unsupported "platform". When the
    // note plus "engineer" is a specific known title, that title replaces the generic engineer group.
    const title = genericRoles ? resolveExact(ROLE_LOOKUP, `${note} engineer`) : undefined
    if (title && title !== ENGINEERING_ROLES) {
      roles = uniq([...title])
      genericRoles = false
      continue
    }
    const rescue = rescueTypo(note)
    if (!rescue) {
      notes.push(note)
      continue
    }
    if (!rescue.exact) out.corrected(note, rescue.target)
    // As for "Android engineer": a skill whose "<skill> engineer" is a role alias names that role when the
    // model only gave the generic engineer group.
    const asRole =
      rescue.kind === 'skill' && genericRoles ? resolveExact(ROLE_LOOKUP, `${rescue.target[0]} engineer`) : undefined
    if (rescue.kind === 'role' || (asRole && asRole !== ENGINEERING_ROLES)) {
      const rescued = rescue.kind === 'role' ? rescue.target : (asRole as readonly Role[])
      roles = uniq(genericRoles ? [...rescued] : [...(roles ?? []), ...rescued])
      genericRoles = genericRoles && rescued === ENGINEERING_ROLES
    } else if (rescue.kind === 'skill') {
      skillsAll.push(...rescue.target.filter((t) => !skillsAll.includes(t)))
    } else {
      const place: Location = rescue.kind === 'city' ? { city: rescue.target[0] } : { state: rescue.target[0] }
      const known = (locations ?? []).some((l) => JSON.stringify(l) === JSON.stringify(place))
      locations = known ? locations : [...(locations ?? []), place]
    }
  }
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
    const value = resolve(COMPANY_TYPE_LOOKUP, raw.company_type.value, out)
    if (value) companyType = { value: value[0], scope: raw.company_type.scope }
    else out.unknown('company type', raw.company_type.value)
  }

  let degrees = mapList(raw.degrees, DEGREE_LOOKUP, 'degree', out)
  let schools = mapList(raw.schools, SCHOOL_LOOKUP, 'school', out)
  let fields = mapList(raw.fields_of_study, FIELD_LOOKUP, 'field of study', out)
  const years = normalizeYears(raw.years_experience, out)

  /** Does an applied filter already hold this value? */
  const applied = (hit: FieldHit): boolean => {
    const all = <T>(list: readonly T[] | undefined, target: readonly T[]) => target.every((t) => list?.includes(t))
    switch (hit.kind) {
      case 'skill':
        return hit.target.every((t) => skillsAll.includes(t) || skillsAny.includes(t))
      case 'role':
        return all(roles, hit.target)
      case 'city':
        return (locations ?? []).some((l) => 'city' in l && l.city === hit.target[0])
      case 'state':
        return (locations ?? []).some((l) => 'state' in l && l.state === hit.target[0])
      case 'company':
        return all(companies?.names, hit.target)
      case 'company type':
        return companyType?.value === hit.target[0]
      case 'degree':
        return all(degrees, hit.target)
      case 'school':
        return all(schools, hit.target)
      case 'field of study':
        return all(fields, hit.target)
      case 'level':
        return all(seniority, hit.target)
    }
  }
  /** Add a value to its real field. False when that would overwrite a different value (one company type). */
  const apply = (hit: FieldHit): boolean => {
    switch (hit.kind) {
      case 'skill':
        skillsAll.push(...hit.target.filter((t) => !skillsAll.includes(t)))
        skillsAny = skillsAny.filter((s) => !skillsAll.includes(s))
        return true
      case 'role': {
        const wasGeneric = genericRoles || !roles
        roles = uniq(genericRoles ? [...hit.target] : [...(roles ?? []), ...hit.target])
        genericRoles = wasGeneric && hit.target === ENGINEERING_ROLES
        return true
      }
      case 'city':
        locations = [...(locations ?? []), { city: hit.target[0] }]
        return true
      case 'state':
        locations = [...(locations ?? []), { state: hit.target[0] }]
        return true
      case 'company':
        companies = { names: uniq([...(companies?.names ?? []), ...hit.target]), scope: companies?.scope ?? 'any' }
        return true
      case 'company type':
        if (companyType) return false
        companyType = { value: hit.target[0], scope: 'any' }
        return true
      case 'degree':
        degrees = uniq([...(degrees ?? []), ...hit.target])
        return true
      case 'school':
        schools = uniq([...(schools ?? []), ...hit.target])
        return true
      case 'field of study':
        fields = uniq([...(fields ?? []), ...hit.target])
        return true
      case 'level':
        seniority = uniq([...(seniority ?? []), ...hit.target])
        return true
    }
  }

  // A value the model wrote into the wrong field ("React" as a role, next to the skill React) is not a requirement
  // the data can't express. It is dropped when its real field already holds it, moved there when it names exactly
  // one other field's value, and reported as unsupported only when it matches no field at all.
  for (const { kind, value } of out.unmatched) {
    const hits = otherFieldHits(value, kind)
    if (hits.some(applied)) continue
    if (hits.length === 1 && key(value).length >= MIN_MOVE_KEY && apply(hits[0])) continue
    out.unsupported(kind, value)
  }
  // A model-reported note is material only if it states a requirement: not a stray number or symbol (no letters),
  // and not a value an applied filter already holds.
  for (const note of notes) {
    if (!/\p{L}/u.test(note) || otherFieldHits(note, undefined).some(applied)) continue
    out.note(note)
  }
  const preferences = uniq(
    cleanStrings(raw.preferences).map((p) => {
      for (const map of PREFERENCE_LOOKUPS) {
        const hit = resolve(map, p, out)
        if (hit?.length === 1) return hit[0]
      }
      return clip(p, MAX_NOTE)
    }),
  ).slice(0, MAX_NOTES)

  const others: unknown[] = [seniority, years?.min, years?.max, locations, raw.open_to_work, companies, companyType]
  const otherConstraint = [...others, degrees, schools, fields].some((v) => v !== undefined && v !== null)
  const onlyGenericRoles = genericRoles && !otherConstraint && skillsAll.length === 0 && skillsAny.length === 0
  if (onlyGenericRoles) out.note(TOO_VAGUE_NOTE)

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
    ...(out.corrections.length > 0 && { corrections: out.corrections.slice(0, MAX_NOTES) }),
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
