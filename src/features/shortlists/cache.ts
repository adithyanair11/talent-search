/**
 * Pure updaters for the shortlist query cache, applied optimistically before the server confirms
 * (and rolled back from a snapshot if it doesn't).
 */
import { SHORTLIST_AVATARS, type ShortlistDetail, type ShortlistSummary } from "@/lib/schemas/shortlists"

export type MemberRef = { id: string; avatar_url: string | null }

/** Add or remove one person on one list. A no-op when membership already matches. */
export function setMember(
  lists: readonly ShortlistSummary[],
  listId: string,
  person: MemberRef,
  on: boolean,
): ShortlistSummary[] {
  return lists.map((l) => {
    if (l.id !== listId || l.person_ids.includes(person.id) === on) return l
    if (on) {
      return {
        ...l,
        count: l.count + 1,
        person_ids: [person.id, ...l.person_ids],
        avatar_urls: person.avatar_url
          ? [person.avatar_url, ...l.avatar_urls].slice(0, SHORTLIST_AVATARS)
          : l.avatar_urls,
      }
    }
    return {
      ...l,
      count: l.count - 1,
      person_ids: l.person_ids.filter((id) => id !== person.id),
      // The next-newest avatar isn't known locally; the refetch after the mutation fills the gap.
      avatar_urls: person.avatar_url ? l.avatar_urls.filter((url) => url !== person.avatar_url) : l.avatar_urls,
    }
  })
}

export function removeMember(detail: ShortlistDetail, personId: string): ShortlistDetail {
  const people = detail.people.filter((p) => p.id !== personId)
  return people.length === detail.people.length ? detail : { ...detail, people, count: people.length }
}

export function renameList(lists: readonly ShortlistSummary[], id: string, name: string): ShortlistSummary[] {
  return lists.map((l) => (l.id === id ? { ...l, name } : l))
}

export function removeList(lists: readonly ShortlistSummary[], id: string): ShortlistSummary[] {
  return lists.filter((l) => l.id !== id)
}

/** A list the server just created: newest first, like the API orders them. */
export function prependList(lists: readonly ShortlistSummary[], id: string, name: string): ShortlistSummary[] {
  const now = new Date().toISOString()
  const created: ShortlistSummary = {
    id,
    name,
    count: 0,
    avatar_urls: [],
    person_ids: [],
    created_at: now,
    updated_at: now,
  }
  return [created, ...lists.filter((l) => l.id !== id)]
}

/** Every person on at least one list (drives the filled bookmark on rows). */
export function shortlistedIds(lists: readonly ShortlistSummary[]): ReadonlySet<string> {
  return new Set(lists.flatMap((l) => l.person_ids))
}

/** Case-insensitive, like the database's unique index: used to catch a duplicate before the round trip. */
export function nameTaken(lists: readonly ShortlistSummary[], name: string, exceptId?: string): boolean {
  const key = name.trim().toLowerCase()
  return lists.some((l) => l.id !== exceptId && l.name.toLowerCase() === key)
}
