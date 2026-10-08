/**
 * `filters.unsupported` notes: written by the server normalizer, shown by the UI. The stored note keeps the
 * normalizer's precise wording (snapshots and saved searches already hold it); `unsupportedLabel` turns it into
 * the short phrase recruiters see ("React as a job title"). Free-text notes from the model ("speaks Japanese")
 * are already phrased for people and pass through unchanged. No zod here: this module ships to the client.
 */

/** The filter a value was written to, as it appears in the note. */
export type UnsupportedKind =
  | "role"
  | "level"
  | "location"
  | "skill"
  | "company"
  | "company type"
  | "degree"
  | "school"
  | "field of study"

const KIND_PHRASES: Record<UnsupportedKind, string> = {
  role: "a job title",
  level: "a seniority level",
  location: "a location",
  skill: "a skill",
  company: "a company",
  "company type": "a company type",
  degree: "a degree",
  school: "a school",
  "field of study": "a field of study",
}

/** A search that is only "engineers" (well over half the data) is not a brief: it would return near-everyone. */
export const TOO_VAGUE_NOTE =
  'the brief is too vague to search: "engineers" alone matches most of the data — add a role, skill, level, location or education'

/** The normalizer's note for a value that matches no field of the data. `value` is already clipped. */
export function unsupportedNote(kind: UnsupportedKind, value: string): string {
  return `${kind} "${value}" is not in the data`
}

const VALUE_NOTE = /^(role|level|location|skill|company type|company|degree|school|field of study) "(.*)" is not in the data$/
const YEARS_NOTE = /^years of experience (.*) is not a valid range$/

/** The short phrase shown on the unsupported chip and in the zero-results message. */
export function unsupportedLabel(note: string): string {
  if (note === TOO_VAGUE_NOTE) return "“engineers” on its own"
  const value = VALUE_NOTE.exec(note)
  if (value) return `${value[2]} as ${KIND_PHRASES[value[1] as UnsupportedKind]}`
  const years = YEARS_NOTE.exec(note)
  if (years) return `${years[1]} years of experience`
  return note
}
