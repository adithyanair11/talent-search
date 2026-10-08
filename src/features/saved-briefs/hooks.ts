"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { Route } from "next"
import { useRouter } from "next/navigation"
import { useCallback, useMemo, useState } from "react"
import type { Plan } from "@/components/plan-badge"
import { toast, toastUndo } from "@/components/toast"
import { planKeys } from "@/features/plan/hooks"
import { usePendingUntilHydrated } from "@/hooks/use-hydrated"
import { useUpgradeStore } from "@/features/plan/store"
import { useRunSearch } from "@/features/search/hooks"
import { ApiError } from "@/lib/api-client"
import type { Filters } from "@/lib/schemas/filters"
import type { SavedBrief } from "@/lib/schemas/saved-briefs"
import { createSavedBrief, deleteSavedBrief, fetchSavedBriefs } from "./api"
import { searchKey } from "./same-search"

export const savedBriefKeys = { all: ["saved-briefs"] as const }

/**
 * GET /api/saved-briefs: the company's saved searches, newest first. Read by the shell sidebar and by pages, so it
 * stays pending while the caller hydrates (see `usePendingUntilHydrated`).
 */
export function useSavedBriefs() {
  return usePendingUntilHydrated(
    useQuery({
      queryKey: savedBriefKeys.all,
      queryFn: ({ signal }) => fetchSavedBriefs(signal).then((r) => r.saved_briefs),
    }),
  )
}

/** Whether this exact brief + filters is already saved (drives the "Saved" state of the button). */
export function useIsSaved(brief: string | undefined, filters: Filters | undefined): boolean {
  const { data } = useSavedBriefs()
  return useMemo(() => {
    if (!data || brief === undefined || !filters) return false
    const key = searchKey(brief, filters)
    return data.some((s) => searchKey(s.brief, s.filters) === key)
  }, [data, brief, filters])
}

/** POST /api/saved-briefs, then a toast with a "View" link to /saved. */
export function useSaveBrief() {
  const qc = useQueryClient()
  const router = useRouter()
  return useMutation({
    mutationFn: ({ brief, filters }: { brief: string; filters: Filters }) => createSavedBrief(brief, filters),
    onSuccess: () => {
      toast.success("Search saved", {
        action: { label: "View", onClick: () => router.push("/saved") },
      })
    },
    onError: () => toast.error("Couldn't save this search. Try again."),
    onSettled: () => qc.invalidateQueries({ queryKey: savedBriefKeys.all }),
  })
}

/**
 * DELETE /api/saved-briefs/{id}, optimistic, with an Undo toast. Undo saves the same brief + filters again
 * (a new id and saved date: the table only lets recruiters write `brief` and `filters`).
 */
export function useDeleteSavedBrief() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (saved: SavedBrief) => deleteSavedBrief(saved.id),
    onMutate: async (saved) => {
      await qc.cancelQueries({ queryKey: savedBriefKeys.all })
      const before = qc.getQueryData<SavedBrief[]>(savedBriefKeys.all)
      qc.setQueryData<SavedBrief[]>(savedBriefKeys.all, (list) => list?.filter((s) => s.id !== saved.id))
      return before
    },
    onError: (_err, _saved, before) => {
      if (before) qc.setQueryData(savedBriefKeys.all, before)
      toast.error("Couldn't delete this saved search. Try again.")
    },
    onSuccess: (_data, saved) => {
      toastUndo(
        "Deleted saved search",
        () => {
          createSavedBrief(saved.brief, saved.filters)
            .then(() => toast.success("Restored saved search"))
            .catch(() => toast.error("Couldn't restore the saved search. Try again."))
            .finally(() => void qc.invalidateQueries({ queryKey: savedBriefKeys.all }))
        },
        saved.brief,
      )
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: savedBriefKeys.all }),
  }).mutate
}

/**
 * Re-run a saved search with its brief and filters (POST /api/search — a new search, so it counts against the
 * free plan). With no free searches left the UpgradeDialog opens instead of calling the API; a 402 race does
 * the same. On success the results open on /search.
 */
export function useRunSavedSearch() {
  const qc = useQueryClient()
  const router = useRouter()
  const openUpgrade = useUpgradeStore((s) => s.open)
  const { mutate } = useRunSearch()
  const [pendingId, setPendingId] = useState<string | null>(null)

  const run = useCallback(
    (saved: SavedBrief) => {
      const plan = qc.getQueryData<Plan>(planKeys.all)
      if (plan?.plan === "free" && plan.searches_remaining === 0) {
        openUpgrade("quota")
        return
      }
      setPendingId(saved.id)
      mutate(
        { brief: saved.brief, filters: saved.filters },
        {
          onSuccess: (res) => router.push(`/search?s=${res.search_id}` as Route),
          onError: (err) => {
            if (err instanceof ApiError && err.status === 402) openUpgrade("quota")
            else toast.error(`Couldn't run this search. ${err.message}`)
          },
          onSettled: () => setPendingId(null),
        },
      )
    },
    [qc, mutate, router, openUpgrade],
  )

  return { run, pendingId }
}
