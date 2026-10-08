import type { Filters } from "@/lib/schemas/filters"

/** JSON with object keys sorted, so filters that round-tripped through jsonb (which reorders keys) compare equal. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(",")}}`
  }
  return JSON.stringify(value)
}

/** Key identifying a search by what it would run: the trimmed brief plus its filters. */
export function searchKey(brief: string, filters: Filters): string {
  return `${brief.trim()}\n${canonical(filters)}`
}
