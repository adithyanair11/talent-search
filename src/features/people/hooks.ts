"use client"

import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useCallback } from "react"
import { fetchPerson } from "./api"

export const personKeys = {
  all: ["person"] as const,
  detail: (id: string) => ["person", id] as const,
}

/** Candidate profiles are seeded and read-only: once loaded they never go stale in a session. */
const PERSON_STALE_MS = Infinity

const personQuery = (id: string) => ({
  queryKey: personKeys.detail(id),
  queryFn: ({ signal }: { signal: AbortSignal }) => fetchPerson(id, signal),
  staleTime: PERSON_STALE_MS,
})

/** GET /api/people/{id} for the candidate sheet. */
export function usePerson(id: string | null) {
  return useQuery({ ...personQuery(id ?? ""), enabled: id !== null })
}

/**
 * Stable callback that warms a profile (and the sheet's code chunk) before it is opened — wire it to row
 * hover/focus. Already-cached profiles are not refetched.
 */
export function usePrefetchPerson(): (id: string) => void {
  const queryClient = useQueryClient()
  return useCallback(
    (id: string) => {
      void import("@/components/candidate-sheet")
      void queryClient.prefetchQuery(personQuery(id))
    },
    [queryClient],
  )
}
