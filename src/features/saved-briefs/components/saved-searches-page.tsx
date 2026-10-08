"use client"

import { StarIcon } from "lucide-react"
import Link from "next/link"
import { EmptyState } from "@/components/empty-state"
import { ErrorState } from "@/components/error-state"
import { Button } from "@/components/ui/button"
import { usePlan } from "@/features/plan/hooks"
import { useDeleteSavedBrief, useRunSavedSearch, useSavedBriefs } from "../hooks"
import { SavedBriefRow, SavedBriefRowSkeleton } from "./saved-brief-row"

const LIST = "divide-y divide-border overflow-hidden rounded-xl border border-border bg-card"
const STATE_CARD = "rounded-2xl border border-border bg-card"

/** /saved: every saved search, newest first, with Run (a new search) and Delete + Undo. */
export function SavedSearchesPage() {
  const saved = useSavedBriefs()
  const remove = useDeleteSavedBrief()
  const { run, pendingId } = useRunSavedSearch()
  const plan = usePlan()

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
      <div className={STATE_CARD}>
        <ErrorState
          title="Couldn't load your saved searches"
          message="They're still saved. Check your connection and try again."
          onRetry={() => void saved.refetch()}
          retrying={saved.isFetching}
        />
      </div>
    )
  } else if (saved.data.length === 0) {
    body = (
      <div className={STATE_CARD}>
        <EmptyState
          icon={StarIcon}
          title="No saved searches yet"
          description="After a search, press Save search above the results. We keep the brief and your edited filters so anyone at your company can re-run it for fresh results."
          action={
            <Button asChild variant="outline">
              <Link href="/search">Start a search</Link>
            </Button>
          }
        />
      </div>
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
      <div className="mb-6 space-y-1 md:mb-8">
        <h1 className="text-2xl font-semibold">Saved searches</h1>
        <p className="text-sm text-pretty text-muted-foreground">
          Running one starts a fresh search with the same brief and filters
          {plan.data?.plan === "free" ? ", so it counts as a search on the free plan." : "."}
        </p>
      </div>
      {body}
    </div>
  )
}
