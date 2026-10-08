"use client"

import { HistoryIcon } from "lucide-react"
import Link from "next/link"
import { EmptyState } from "@/components/empty-state"
import { ErrorState } from "@/components/error-state"
import { Button } from "@/components/ui/button"
import { useDeleteSavedBrief, useRunSavedSearch, useSavedBriefs } from "../hooks"
import { SavedBriefRow, SavedBriefRowSkeleton } from "./saved-brief-row"

const LIST = "divide-y divide-border rounded-lg border border-border"

/** /saved: every saved search, newest first, with Run (a new search) and Delete + Undo. */
export function SavedSearchesPage() {
  const saved = useSavedBriefs()
  const remove = useDeleteSavedBrief()
  const { run, pendingId } = useRunSavedSearch()

  let body: React.ReactNode
  if (saved.isPending) {
    body = (
      <ul role="status" aria-label="Loading saved searches" className={LIST}>
        {Array.from({ length: 4 }, (_, i) => (
          <SavedBriefRowSkeleton key={i} />
        ))}
      </ul>
    )
  } else if (saved.isError) {
    body = (
      <ErrorState
        title="Couldn't load your saved searches"
        message={saved.error.message}
        onRetry={() => void saved.refetch()}
        retrying={saved.isFetching}
      />
    )
  } else if (saved.data.length === 0) {
    body = (
      <EmptyState
        icon={HistoryIcon}
        title="No saved searches yet"
        description="After a search, use “Save search” next to the result count. Saving keeps the brief and the filters as you edited them, so anyone at your company can re-run it later and get fresh results."
        action={
          <Button asChild variant="outline">
            <Link href="/search">Start a search</Link>
          </Button>
        }
      />
    )
  } else {
    body = (
      <ul className={LIST}>
        {saved.data.map((s) => (
          <SavedBriefRow
            key={s.id}
            saved={s}
            running={pendingId === s.id}
            disabled={pendingId !== null}
            onRun={run}
            onDelete={remove}
          />
        ))}
      </ul>
    )
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 md:py-10">
      <div className="mb-6 space-y-1">
        <h1 className="text-2xl font-semibold">Saved searches</h1>
        <p className="text-sm text-muted-foreground">
          Running one starts a new search with the same brief and filters.
        </p>
      </div>
      {body}
    </div>
  )
}
