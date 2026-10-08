import { describe, expect, it } from "vitest"

import { TOO_VAGUE_NOTE, unsupportedLabel, unsupportedNote } from "./unsupported"

describe("unsupportedLabel", () => {
  it("turns the normalizer's notes into short phrases, never the raw reason", () => {
    expect(unsupportedLabel(unsupportedNote("role", "React"))).toBe("React as a job title")
    expect(unsupportedLabel(unsupportedNote("location", "London"))).toBe("London as a location")
    expect(unsupportedLabel(unsupportedNote("company type", "nonprofit"))).toBe("nonprofit as a company type")
    expect(unsupportedLabel(unsupportedNote("field of study", "Biology"))).toBe("Biology as a field of study")
    expect(unsupportedLabel("years of experience 20–5 is not a valid range")).toBe("20–5 years of experience")
    expect(unsupportedLabel(TOO_VAGUE_NOTE)).toBe("“engineers” on its own")
  })

  it("keeps quotes inside a value", () => {
    expect(unsupportedLabel(unsupportedNote("skill", 'the "best" stack'))).toBe('the "best" stack as a skill')
  })

  it("passes the model's own phrases through unchanged", () => {
    expect(unsupportedLabel("speaks Japanese")).toBe("speaks Japanese")
    expect(unsupportedLabel('role "React" is in the data')).toBe('role "React" is in the data')
  })
})
