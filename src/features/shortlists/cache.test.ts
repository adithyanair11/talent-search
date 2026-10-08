import { describe, expect, it } from "vitest"

import type { ShortlistDetail, ShortlistSummary } from "@/lib/schemas/shortlists"

import { nameTaken, prependList, removeList, removeMember, renameList, setMember, shortlistedIds } from "./cache"

const list = (over: Partial<ShortlistSummary> = {}): ShortlistSummary => ({
  id: "l1",
  name: "Frontend Q4",
  count: 2,
  avatar_urls: ["a2", "a1"],
  person_ids: ["p2", "p1"],
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  ...over,
})

describe("shortlist cache updaters", () => {
  it("adds a member newest first and caps avatars at 4", () => {
    const full = list({ avatar_urls: ["a4", "a3", "a2", "a1"], person_ids: ["p4", "p3", "p2", "p1"], count: 4 })
    const [next] = setMember([full], "l1", { id: "p5", avatar_url: "a5" }, true)
    expect(next.count).toBe(5)
    expect(next.person_ids[0]).toBe("p5")
    expect(next.avatar_urls).toEqual(["a5", "a4", "a3", "a2"])
  })

  it("removes a member and its avatar; leaves other lists alone", () => {
    const other = list({ id: "l2" })
    const [next, untouched] = setMember([list(), other], "l1", { id: "p2", avatar_url: "a2" }, false)
    expect(next).toMatchObject({ count: 1, person_ids: ["p1"], avatar_urls: ["a1"] })
    expect(untouched).toBe(other)
  })

  it("is a no-op when membership already matches (idempotent add / remove)", () => {
    const l = list()
    expect(setMember([l], "l1", { id: "p1", avatar_url: "a1" }, true)[0]).toBe(l)
    expect(setMember([l], "l1", { id: "p9", avatar_url: null }, false)[0]).toBe(l)
  })

  it("removes a member from a detail view", () => {
    const detail = { id: "l1", name: "x", count: 2, people: [{ id: "p2" }, { id: "p1" }] } as ShortlistDetail
    expect(removeMember(detail, "p2")).toMatchObject({ count: 1, people: [{ id: "p1" }] })
    expect(removeMember(detail, "p9")).toBe(detail)
  })

  it("renames, removes and prepends lists", () => {
    const lists = [list(), list({ id: "l2", name: "Design" })]
    expect(renameList(lists, "l2", "Brand")[1].name).toBe("Brand")
    expect(removeList(lists, "l1").map((l) => l.id)).toEqual(["l2"])
    const created = prependList(lists, "l3", "New")
    expect(created[0]).toMatchObject({ id: "l3", name: "New", count: 0, person_ids: [] })
    expect(prependList(created, "l3", "New")).toHaveLength(3)
  })

  it("collects every shortlisted person once", () => {
    const ids = shortlistedIds([list(), list({ id: "l2", person_ids: ["p1", "p3"] })])
    expect([...ids].sort()).toEqual(["p1", "p2", "p3"])
  })

  it("matches names case-insensitively, ignoring the list being renamed", () => {
    const lists = [list()]
    expect(nameTaken(lists, "  frontend q4 ")).toBe(true)
    expect(nameTaken(lists, "Frontend Q4", "l1")).toBe(false)
    expect(nameTaken(lists, "Backend")).toBe(false)
  })
})
