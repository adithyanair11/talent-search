"use client"

import dynamic from "next/dynamic"
import { useEffect, useState } from "react"
import { ShortlistMenu } from "@/features/shortlists/components/shortlist-menu"
import { useShortlistedIds } from "@/features/shortlists/hooks"
import { useIsDesktop } from "@/hooks/use-media-query"
import { ApiError } from "@/lib/api-client"
import { usePerson, usePrefetchPerson } from "../hooks"

// Heavy and opened on demand: its chunk loads on first open (or on row hover, via usePrefetchPerson).
const CandidateSheet = dynamic(() => import("@/components/candidate-sheet").then((m) => m.CandidateSheet), {
  ssr: false,
})

/** When the open candidate is this close to the end of the loaded results, load the next page. */
const LOAD_MORE_WITHIN = 3

function isEditable(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT")
  )
}

/**
 * The candidate sheet for `personId`, with ←/→ (and toolbar buttons) stepping through `ids` — the loaded
 * results, in rank order. Neighbours are prefetched so stepping is instant. Keeps the last candidate mounted
 * while closing so the exit animation has content.
 */
export function CandidateSheetContainer({
  personId,
  onClose,
  onStep,
  ids = [],
  total,
  hasMore = false,
  onLoadMore,
  matchedSkills,
}: {
  personId: string | null
  onClose: () => void
  onStep?: (id: string) => void
  ids?: readonly string[]
  total?: number
  hasMore?: boolean
  onLoadMore?: () => void
  matchedSkills?: ReadonlySet<string>
}) {
  const [shownId, setShownId] = useState(personId)
  if (personId !== null && personId !== shownId) setShownId(personId)

  const query = usePerson(shownId)
  const prefetch = usePrefetchPerson()
  const shortlisted = useShortlistedIds()
  const isDesktop = useIsDesktop()
  const open = personId !== null

  const index = shownId === null ? -1 : ids.indexOf(shownId)
  const inList = index >= 0 && onStep !== undefined
  const previousId = inList && index > 0 ? ids[index - 1] : null
  const nextId = inList && index < ids.length - 1 ? ids[index + 1] : null

  useEffect(() => {
    if (!open) return
    if (previousId) prefetch(previousId)
    if (nextId) prefetch(nextId)
  }, [open, previousId, nextId, prefetch])

  useEffect(() => {
    if (open && inList && hasMore && index >= ids.length - LOAD_MORE_WITHIN) onLoadMore?.()
  }, [open, inList, hasMore, index, ids.length, onLoadMore])

  useEffect(() => {
    if (!open || !onStep) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || isEditable(e.target)) return
      const target = e.key === "ArrowLeft" ? previousId : e.key === "ArrowRight" ? nextId : null
      if (!target) return
      e.preventDefault()
      onStep(target)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [open, onStep, previousId, nextId])

  if (shownId === null) return null

  const notFound = query.error instanceof ApiError && query.error.status === 404
  return (
    <CandidateSheet
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
      status={query.isPending ? "pending" : query.isError ? "error" : "success"}
      candidate={query.data}
      errorTitle={notFound ? "This candidate isn't available" : undefined}
      errorMessage={notFound ? "The link may be incomplete." : query.error?.message}
      onRetry={notFound ? undefined : () => void query.refetch()}
      retrying={query.isFetching}
      matchedSkills={matchedSkills}
      onPrevious={inList ? (previousId ? () => onStep(previousId) : null) : undefined}
      onNext={inList ? (nextId ? () => onStep(nextId) : null) : undefined}
      positionLabel={inList && total !== undefined ? `${index + 1} of ${total.toLocaleString()}` : undefined}
      actions={
        query.data && (
          <ShortlistMenu
            person={query.data}
            shortlisted={shortlisted.has(query.data.id)}
            variant="button"
            nested={!isDesktop}
          />
        )
      }
    />
  )
}
