import { describe, expect, it } from "vitest"

import { filtersSchema, type Filters } from "@/lib/schemas/filters"

import { chipsFor, formatYearsRange, hasConstraints, parseYearsRange, toggleValue, withFilter } from "./filter-model"

const filters: Filters = {
  roles: ["Frontend Engineer"],
  seniority: ["senior", "staff"],
  years_experience: { min: 5 },
  locations: [{ city: "Austin" }, { state: "CA" }],
  open_to_work: true,
  companies: { names: ["Fernway"], scope: "current" },
  company_type: { value: "startup", scope: "any" },
  unsupported: ["speaks Spanish"],
  interpretation: "Senior frontend engineers",
}

describe("filter chips", () => {
  it("makes one chip per constraint, in a stable order, ignoring explanatory fields", () => {
    expect(chipsFor(filters)).toEqual([
      { key: "roles", label: "Role", value: "Frontend Engineer" },
      { key: "seniority", label: "Seniority", value: "Senior, Staff" },
      { key: "years_experience", label: "Experience", value: "5+ yrs" },
      { key: "locations", label: "Location", value: "Austin, CA (state)" },
      { key: "open_to_work", label: "Open to work", value: "Yes" },
      { key: "companies", label: "Current company", value: "Fernway" },
      { key: "company_type", label: "Company type", value: "Startup" },
    ])
    expect(chipsFor({ open_to_work: false })).toEqual([{ key: "open_to_work", label: "Open to work", value: "No" }])
  })

  it("formats experience ranges", () => {
    expect(formatYearsRange({ min: 3, max: 5 })).toBe("3–5 yrs")
    expect(formatYearsRange({ min: 4, max: 4 })).toBe("4 yrs")
    expect(formatYearsRange({ max: 2 })).toBe("≤ 2 yrs")
  })
})

describe("editing", () => {
  it("sets, replaces and removes keys without mutating the input", () => {
    const removed = withFilter(filters, "roles", undefined)
    expect(removed.roles).toBeUndefined()
    expect(filters.roles).toEqual(["Frontend Engineer"])
    expect(withFilter(filters, "seniority", []).seniority).toBeUndefined()
    expect(withFilter(filters, "open_to_work", false).open_to_work).toBe(false)
  })

  it("keeps edited filters valid for the server schema", () => {
    const edited = withFilter(withFilter(filters, "skills_all", toggleValue(undefined, "React")), "unsupported", [])
    expect(filtersSchema.safeParse(edited).success).toBe(true)
  })

  it("toggles list values", () => {
    expect(toggleValue(["React"], "Go")).toEqual(["React", "Go"])
    expect(toggleValue(["React", "Go"], "React")).toEqual(["Go"])
  })

  it("parses and validates the experience editor", () => {
    expect(parseYearsRange("3", "")).toEqual({ range: { min: 3 } })
    expect(parseYearsRange("", "")).toEqual({ range: undefined })
    expect(parseYearsRange("6", "2")).toHaveProperty("error")
    expect(parseYearsRange("1.5", "")).toHaveProperty("error")
    expect(parseYearsRange("", "99")).toHaveProperty("error")
  })

  it("knows when nothing is constrained", () => {
    expect(hasConstraints({ unsupported: ["x"], interpretation: "y" })).toBe(false)
    expect(hasConstraints({ open_to_work: false })).toBe(true)
  })
})
