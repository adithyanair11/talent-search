"use client"

import { BookmarkIcon, PlusIcon } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { EmptyState } from "@/components/empty-state"
import { ErrorState } from "@/components/error-state"
import { Button } from "@/components/ui/button"
import { useCreateShortlist, useDeleteShortlist, useShortlists } from "../hooks"
import { NameForm } from "./name-form"
import { ShortlistCard, ShortlistCardSkeleton } from "./shortlist-card"

const GRID = "grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
const STATE_CARD = "rounded-2xl border border-border bg-card"

/** /shortlists: every company list as a card, newest first, with create, inline rename and delete + undo. */
export function ShortlistsPage() {
  const lists = useShortlists()
  const create = useCreateShortlist()
  const remove = useDeleteShortlist()
  const [creating, setCreating] = useState(false)

  const newList = creating && (
    <div className="h-full rounded-xl border border-primary/40 bg-card p-4 ring-[3px] ring-primary/10 sm:p-5">
      <NameForm
        submitLabel="Create"
        onCancel={() => setCreating(false)}
        onSubmit={async (name) => {
          await create.mutateAsync(name)
          setCreating(false)
        }}
      />
      <p className="mt-2 text-sm text-muted-foreground">Then add people from search results with Shortlist.</p>
    </div>
  )

  let body: React.ReactNode
  if (lists.isPending) {
    body = (
      <div role="status" aria-label="Loading shortlists" className={GRID}>
        {Array.from({ length: 6 }, (_, i) => (
          <ShortlistCardSkeleton key={i} />
        ))}
      </div>
    )
  } else if (lists.isError) {
    body = (
      <div className={STATE_CARD}>
        <ErrorState
          title="Couldn't load your shortlists"
          message="Your lists are safe. Check your connection and try again."
          onRetry={() => void lists.refetch()}
          retrying={lists.isFetching}
        />
      </div>
    )
  } else if (lists.data.length === 0 && !creating) {
    body = (
      <div className={STATE_CARD}>
        <EmptyState
          icon={BookmarkIcon}
          title="No shortlists yet"
          description="Press Shortlist on any search result to start a list, or create an empty one with New list."
          action={
            <Button asChild variant="outline">
              <Link href="/search">Find candidates</Link>
            </Button>
          }
        />
      </div>
    )
  } else {
    body = (
      <ul className={GRID}>
        {newList && <li>{newList}</li>}
        {lists.data.map((l) => (
          <li key={l.id} className="h-full">
            <ShortlistCard list={l} onDelete={remove} />
          </li>
        ))}
      </ul>
    )
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 md:py-10">
      <div className="mb-6 flex items-end justify-between gap-3 md:mb-8">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold">Shortlists</h1>
          <p aria-live="polite" className="mt-1 min-h-5 text-sm text-muted-foreground tabular-nums">
            {lists.data && lists.data.length > 0
              ? `${lists.data.length} ${lists.data.length === 1 ? "list" : "lists"}, shared with everyone at your company`
              : "Shared with everyone at your company"}
          </p>
        </div>
        <Button onClick={() => setCreating(true)} disabled={creating || !lists.data} className="max-md:h-11">
          <PlusIcon /> New list
        </Button>
      </div>
      {body}
    </div>
  )
}
