import { describe, expect, it } from "vitest"
import { formatLocation, formatYearRange, formatYears, initials, topSkills } from "./candidate"

describe("candidate formatters", () => {
  it("formats location", () => {
    expect(formatLocation({ city: "New York", state: "NY", country: "US" })).toBe("New York, NY")
    expect(formatLocation({ city: "Lisbon", state: "", country: "PT" })).toBe("Lisbon")
  })

  it("formats years of experience", () => {
    expect(formatYears(0)).toBe("< 1 yr")
    expect(formatYears(1)).toBe("1 yr")
    expect(formatYears(12)).toBe("12 yrs")
  })

  it("formats year ranges", () => {
    expect(formatYearRange(2022, null)).toBe("2022 — Present")
    expect(formatYearRange(2020, 2024)).toBe("2020 — 2024")
    expect(formatYearRange(2021, 2021)).toBe("2021")
  })

  it("derives initials", () => {
    expect(initials("Amara Cohen")).toBe("AC")
    expect(initials("  Cher ")).toBe("C")
    expect(initials("Mary Ann de la Cruz")).toBe("MC")
    expect(initials("")).toBe("?")
  })

  it("splits top skills", () => {
    expect(topSkills(["a", "b", "c", "d", "e"])).toEqual({ visible: ["a", "b", "c"], overflow: 2 })
    expect(topSkills(["a"], 3)).toEqual({ visible: ["a"], overflow: 0 })
  })
})
