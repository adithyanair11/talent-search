import { describe, expect, it } from "vitest"
import { searchKey } from "./same-search"

describe("searchKey", () => {
  it("ignores key order, undefined keys and surrounding whitespace", () => {
    expect(
      searchKey(" senior react ", {
        seniority: ["senior"],
        years_experience: { min: 5, max: 9 },
      }),
    ).toBe(
      searchKey("senior react", {
        years_experience: { max: 9, min: 5 },
        seniority: ["senior"],
        roles: undefined,
      }),
    )
  })

  it("distinguishes different briefs, values and value order", () => {
    const base = searchKey("x", { seniority: ["senior", "staff"] })
    expect(searchKey("y", { seniority: ["senior", "staff"] })).not.toBe(base)
    expect(searchKey("x", { seniority: ["staff", "senior"] })).not.toBe(base)
    expect(searchKey("x", { seniority: ["senior"] })).not.toBe(base)
  })
})
