/**
 * Display types and pure formatters for candidates. The API layer will validate payloads with zod
 * and map them onto these shapes; components only ever depend on these types.
 */

export type Seniority = "junior" | "mid" | "senior" | "staff"

export type CandidateLocation = { city: string; state: string; country: string }

/** What a result row needs. */
export type CandidateSummary = {
  id: string
  full_name: string
  avatar_url: string | null
  current_title: string
  current_company: string
  current_company_logo_url: string | null
  years_experience: number
  location: CandidateLocation
  open_to_work: boolean
  skills: string[]
}

export type CandidateExperience = {
  title: string
  company: string
  company_logo_url: string | null
  company_type: "startup" | "enterprise" | string
  start_year: number
  end_year: number | null
  description?: string
}

export type CandidateEducation = {
  school: string
  degree: string
  field: string
  graduation_year: number
}

/** What the candidate sheet needs. */
export type CandidateDetail = CandidateSummary & {
  headline: string
  role: string
  seniority: Seniority
  experiences: CandidateExperience[]
  education: CandidateEducation[]
}

export function formatLocation(loc: CandidateLocation): string {
  return loc.state ? `${loc.city}, ${loc.state}` : loc.city
}

export function formatYears(years: number): string {
  if (years <= 0) return "< 1 yr"
  return years === 1 ? "1 yr" : `${years} yrs`
}

export function formatYearRange(start: number, end: number | null): string {
  if (end === null) return `${start} — Present`
  return start === end ? `${start}` : `${start} — ${end}`
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  const first = parts[0][0] ?? ""
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : ""
  return (first + last).toUpperCase()
}

/**
 * Length of a role from whole years (the data has no months): "3 yrs", "< 1 yr" for a role that started and
 * ended in the same year. A current role (`end = null`) runs to `currentYear`.
 */
export function formatDuration(start: number, end: number | null, currentYear = new Date().getFullYear()): string {
  return formatYears(Math.max(0, (end ?? currentYear) - start))
}

/** Matched skills first (stable within each group), so the sheet and rows lead with what the search asked for. */
export function orderSkills(skills: string[], matched?: ReadonlySet<string>): string[] {
  if (!matched || matched.size === 0) return skills
  return [...skills.filter((s) => matched.has(s)), ...skills.filter((s) => !matched.has(s))]
}

/** Split skills into the first `max` visible ones and an overflow count. */
export function topSkills(skills: string[], max = 3): { visible: string[]; overflow: number } {
  return { visible: skills.slice(0, max), overflow: Math.max(0, skills.length - max) }
}
