"use client"

import { useWindowVirtualizer } from "@tanstack/react-virtual"
import { ArrowLeftIcon, BookmarkIcon, BookmarkMinusIcon, PencilIcon, SearchXIcon } from "lucide-react"
import Link from "next/link"
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react"
import { CandidateList, CandidateListSkeleton, CandidateRow } from "@/components/candidate-row"
import { EmptyState } from "@/components/empty-state"
import { ErrorState } from "@/components/error-state"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { CandidateSheetContainer } from "@/features/people/components/candidate-sheet-container"
import { usePrefetchPerson } from "@/features/people/hooks"
import { usePersonParam } from "@/features/people/use-person-param"
import { ApiError } from "@/lib/api-client"
import type { CandidateSummary } from "@/lib/candidate"
import type { ShortlistMember } from "@/lib/schemas/shortlists"
import { useRenameShortlist, useSetMembership, useShortlist } from "../hooks"
import { NameForm } from "./name-form"
import { formatPeople } from "./shortlist-card"

/** Short lists render plainly; longer ones are virtualized against the window. */
const VIRTUALIZE_AFTER = 50

/** /shortlists/[id]: the list's people, most recently added first. Remove with Undo; open the candidate sheet. */
export function ShortlistDetailPage({ id }: { id: string }) {
  const query = useShortlist(id)
  const person = usePersonParam()
  const prefetch = usePrefetchPerson()
  const setMembership = useSetMembership()
  const rename = useRenameShortlist()
  const [renaming, setRenaming] = useState(false)

  const list = query.data
  const ids = useMemo(() => list?.people.map((p) => p.id) ?? [], [list])

  const name = list?.name ?? ""
  // Stable across refetches (changes only on rename), so memoised rows keep their render.
  const renderRemove = useCallback(
    (c: CandidateSummary) => (
      <Button
        variant="ghost"
        size="icon"
        className="text-muted-foreground max-md:size-11"
        aria-label={`Remove ${c.full_name} from this list`}
        onClick={() => setMembership({ list: { id, name }, person: c, on: false })}
      >
        <BookmarkMinusIcon />
      </Button>
    ),
    [id, name, setMembership],
  )

  const back = (
    <Button asChild variant="ghost" size="sm" className="-ml-2.5 mb-3 text-muted-foreground max-md:h-11">
      <Link href="/shortlists">
        <ArrowLeftIcon /> Shortlists
      </Link>
    </Button>
  )

  if (query.isPending) {
    return (
      <Page>
        {back}
        <div aria-hidden className="mb-6 space-y-2">
          <Skeleton className="h-7 w-56" />
          <Skeleton className="h-4 w-20" />
        </div>
        <CandidateListSkeleton rows={4} />
      </Page>
    )
  }

  if (query.isError) {
    const gone = query.error instanceof ApiError && query.error.status === 404
    return (
      <Page>
        {back}
        {gone ? (
          <EmptyState
            icon={SearchXIcon}
            title="This shortlist doesn't exist"
            description="It may have been deleted, or the link is incomplete."
            action={
              <Button asChild variant="outline">
                <Link href="/shortlists">All shortlists</Link>
              </Button>
            }
          />
        ) : (
          <ErrorState
            title="Couldn't load this shortlist"
            message={query.error.message}
            onRetry={() => void query.refetch()}
            retrying={query.isFetching}
          />
        )}
      </Page>
    )
  }

  return (
    <Page>
      {back}
      <header className="mb-6">
        {renaming ? (
          <NameForm
            initialName={list!.name}
            exceptId={id}
            saveOnBlur
            submitLabel="Save"
            inputClassName="md:text-lg"
            onCancel={() => setRenaming(false)}
            onSubmit={async (name) => {
              await rename.mutateAsync({ id, name })
              setRenaming(false)
            }}
          />
        ) : (
          <div className="flex items-center gap-1">
            <h1 className="min-w-0 truncate text-2xl font-semibold">{list!.name}</h1>
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-muted-foreground max-md:size-11"
              aria-label="Rename list"
              onClick={() => setRenaming(true)}
            >
              <PencilIcon />
            </Button>
          </div>
        )}
        <p aria-live="polite" className="mt-1 text-sm text-muted-foreground tabular-nums">
          {formatPeople(list!.count)}
        </p>
      </header>

      {list!.people.length === 0 ? (
        <CandidateList>
          <EmptyState
            icon={BookmarkIcon}
            title="No one on this list yet"
            description="Shortlist someone from search results with the bookmark on their row."
            action={
              <Button asChild variant="outline">
                <Link href="/search">Find candidates</Link>
              </Button>
            }
          />
        </CandidateList>
      ) : list!.people.length > VIRTUALIZE_AFTER ? (
        <VirtualMembers
          people={list!.people}
          selectedId={person.personId}
          onOpen={person.open}
          onPrefetch={prefetch}
          renderRemove={renderRemove}
        />
      ) : (
        <CandidateList>
          {list!.people.map((p, i) => (
            <CandidateRow
              key={p.id}
              candidate={p}
              onOpen={person.open}
              onPrefetch={prefetch}
              selected={p.id === person.personId}
              renderShortlist={renderRemove}
              priority={i < 2}
            />
          ))}
        </CandidateList>
      )}

      <CandidateSheetContainer
        personId={person.personId}
        onClose={person.close}
        onStep={person.step}
        ids={ids}
        total={ids.length}
      />
    </Page>
  )
}

function Page({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 md:py-10">{children}</div>
}

/** Same window-virtualizer pattern as search results (features/search/components/search-results.tsx). */
function VirtualMembers({
  people,
  selectedId,
  onOpen,
  onPrefetch,
  renderRemove,
}: {
  people: ShortlistMember[]
  selectedId: string | null
  onOpen: (id: string) => void
  onPrefetch: (id: string) => void
  renderRemove: (c: CandidateSummary) => React.ReactNode
}) {
  const listRef = useRef<HTMLDivElement>(null)
  const [scrollMargin, setScrollMargin] = useState(0)

  useLayoutEffect(() => {
    const el = listRef.current
    if (!el) return
    const measure = () => setScrollMargin(el.getBoundingClientRect().top + window.scrollY)
    const observer = new ResizeObserver(measure)
    observer.observe(document.body)
    return () => observer.disconnect()
  }, [])

  const virtualizer = useWindowVirtualizer({
    count: people.length,
    estimateSize: () => 116,
    overscan: 6,
    scrollMargin,
    getItemKey: (i) => people[i].id,
  })

  return (
    <CandidateList ref={listRef} className="relative" style={{ height: virtualizer.getTotalSize() }}>
      {virtualizer.getVirtualItems().map((item) => {
        const p = people[item.index]
        return (
          <div
            key={item.key}
            data-index={item.index}
            ref={virtualizer.measureElement}
            className="absolute inset-x-0 top-0"
            style={{ transform: `translateY(${item.start - virtualizer.options.scrollMargin}px)` }}
          >
            <CandidateRow
              candidate={p}
              onOpen={onOpen}
              onPrefetch={onPrefetch}
              selected={p.id === selectedId}
              renderShortlist={renderRemove}
              priority={item.index < 2}
            />
          </div>
        )
      })}
    </CandidateList>
  )
}
