/**
 * Pure helpers that turn canonical search filters into "We understood" chips and apply chip edits.
 * Every editable value comes from the real data vocabulary (src/lib/vocabulary.ts), so an edited filter
 * set always passes `filtersSchema` on the server.
 */
import { CONSTRAINT_KEYS, MAX_YEARS } from "@/lib/limits"
import type { Filters } from "@/lib/schemas/filters"

export type ConstraintKey = (typeof CONSTRAINT_KEYS)[number]

export type Chip = { key: ConstraintKey; label: string; value: string }

export const FILTER_LABELS: Record<ConstraintKey, string> = {
  roles: "Role",
  seniority: "Seniority",
  years_experience: "Experience",
  locations: "Location",
  open_to_work: "Open to work",
  skills_all: "Skills",
  skills_any: "Any of",
  companies: "Company",
  company_type: "Company type",
  degrees: "Degree",
  schools: "School",
  fields_of_study: "Field",
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export function formatYearsRange(r: { min?: number; max?: number }): string {
  if (r.min !== undefined && r.max !== undefined) return r.min === r.max ? `${r.min} yrs` : `${r.min}–${r.max} yrs`
  if (r.min !== undefined) return `${r.min}+ yrs`
  return `≤ ${r.max} yrs`
}

/** Location option text: cities by name, states as "CA (state)". */
export function locationLabel(l: { city: string } | { state: string }): string {
  return "city" in l ? l.city : `${l.state} (state)`
}

function chipFor(key: ConstraintKey, f: Filters): Chip | null {
  const label = FILTER_LABELS[key]
  switch (key) {
    case "seniority":
      return f.seniority ? { key, label, value: f.seniority.map(capitalize).join(", ") } : null
    case "years_experience":
      return f.years_experience ? { key, label, value: formatYearsRange(f.years_experience) } : null
    case "locations":
      return f.locations ? { key, label, value: f.locations.map(locationLabel).join(", ") } : null
    case "open_to_work":
      return f.open_to_work === undefined ? null : { key, label, value: f.open_to_work ? "Yes" : "No" }
    case "companies":
      return f.companies
        ? {
            key,
            label: f.companies.scope === "current" ? "Current company" : label,
            value: f.companies.names.join(", "),
          }
        : null
    case "company_type":
      return f.company_type
        ? {
            key,
            label: f.company_type.scope === "current" ? "Current company type" : label,
            value: capitalize(f.company_type.value),
          }
        : null
    default: {
      const values = f[key]
      return values ? { key, label, value: values.join(", ") } : null
    }
  }
}

/** One chip per constraint that is set, in a stable order. */
export function chipsFor(filters: Filters): Chip[] {
  return CONSTRAINT_KEYS.map((k) => chipFor(k, filters)).filter((c): c is Chip => c !== null)
}

/** Filters with one key set to `value`, or removed when `value` is undefined / an empty list. */
export function withFilter<K extends keyof Filters>(filters: Filters, key: K, value: Filters[K] | undefined): Filters {
  const next = { ...filters }
  if (value === undefined || (Array.isArray(value) && value.length === 0)) delete next[key]
  else next[key] = value
  return next
}

/** Toggle one value in a list, keeping vocabulary order stable for display. */
export function toggleValue<T extends string>(list: readonly T[] | undefined, value: T): T[] {
  const current = list ?? []
  return current.includes(value) ? current.filter((v) => v !== value) : [...current, value]
}

/**
 * Parses the experience editor's two inputs. Empty = unbounded. Returns an error message instead of a
 * range when the input can't be searched, so the editor can explain it without re-running.
 */
export function parseYearsRange(
  minText: string,
  maxText: string,
): { range: { min?: number; max?: number } | undefined } | { error: string } {
  const parse = (t: string) => (t.trim() === "" ? undefined : Number(t))
  const min = parse(minText)
  const max = parse(maxText)
  for (const n of [min, max]) {
    if (n !== undefined && (!Number.isInteger(n) || n < 0 || n > MAX_YEARS)) {
      return { error: `Use whole years from 0 to ${MAX_YEARS}.` }
    }
  }
  if (min !== undefined && max !== undefined && min > max) return { error: "Minimum must be at most the maximum." }
  if (min === undefined && max === undefined) return { range: undefined }
  return { range: { ...(min !== undefined && { min }), ...(max !== undefined && { max }) } }
}

/** Skills that count as matched for highlighting rows (from the filters, never the model). */
export function matchedSkillsOf(filters: Filters): ReadonlySet<string> {
  return new Set<string>([...(filters.skills_all ?? []), ...(filters.skills_any ?? [])])
}

/** True when the filters constrain anything at all. */
export function hasConstraints(filters: Filters): boolean {
  return CONSTRAINT_KEYS.some((k) => filters[k] !== undefined)
}
