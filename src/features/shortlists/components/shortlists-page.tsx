"use client"

import { BookmarkIcon, PlusIcon } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { EmptyState } from "@/components/empty-state"
import { ErrorState } from "@/components/error-state"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { useCreateShortlist, useDeleteShortlist, useShortlists } from "../hooks"
import { NameForm } from "./name-form"
import { ShortlistCard, ShortlistCardSkeleton } from "./shortlist-card"

const GRID = "grid gap-3 sm:grid-cols-2 lg:grid-cols-3"

/** /shortlists: every company list as a card, newest first, with create, inline rename and delete + undo. */
export function ShortlistsPage() {
  const lists = useShortlists()
  const create = useCreateShortlist()
  const remove = useDeleteShortlist()
  const [creating, setCreating] = useState(false)

  const newList = creating && (
    <Card className="gap-0 p-4">
      <NameForm
        submitLabel="Create"
        onCancel={() => setCreating(false)}
        onSubmit={async (name) => {
          await create.mutateAsync(name)
          setCreating(false)
        }}
      />
      <p className="mt-2 text-sm text-muted-foreground">Add people from search results with the bookmark.</p>
    </Card>
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
      <ErrorState
        title="Couldn't load your shortlists"
        message={lists.error.message}
        onRetry={() => void lists.refetch()}
        retrying={lists.isFetching}
      />
    )
  } else if (lists.data.length === 0 && !creating) {
    body = (
      <EmptyState
        icon={BookmarkIcon}
        title="No shortlists yet"
        description="Shortlist someone from search results with the bookmark on their row — or create an empty list now."
        action={
          <Button asChild variant="outline">
            <Link href="/search">Find candidates</Link>
          </Button>
        }
      />
    )
  } else {
    body = (
      <ul className={GRID}>
        {newList && <li>{newList}</li>}
        {lists.data.map((l) => (
          <li key={l.id}>
            <ShortlistCard list={l} onDelete={remove} />
          </li>
        ))}
      </ul>
    )
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 md:py-10">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Shortlists</h1>
          <p aria-live="polite" className="mt-1 min-h-5 text-sm text-muted-foreground tabular-nums">
            {lists.data && lists.data.length > 0
              ? `${lists.data.length} ${lists.data.length === 1 ? "list" : "lists"}`
              : null}
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
