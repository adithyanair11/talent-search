"use client"

import { useWindowVirtualizer } from "@tanstack/react-virtual"
import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { CandidateCard, CandidateCardList, CandidateCardSkeleton } from "@/components/candidate-card"
import { ErrorState } from "@/components/error-state"
import { renderShortlistMenu } from "@/features/shortlists/components/shortlist-menu"
import { useShortlistedIds } from "@/features/shortlists/hooks"
import type { SearchResult } from "@/lib/schemas/search"

/** Load the next page when the last rendered row is this close to the end of what's loaded. */
const PREFETCH_ROWS = 8
/** The entrance plays on the first page only; the stagger is capped so the last cards don't lag. */
const INTRO_ROWS = 20
const INTRO_STAGGER_MS = 60
const INTRO_MAX_DELAY_MS = 480

/**
 * Ranked result cards, virtualized against the window (the page scrolls, so the composer can stay sticky).
 * Pages load on demand from the stored snapshot; the next page is fetched before the end is reached.
 * `animateIntro` makes the first page rise in like a chat answer (once per result set).
 */
export function SearchResults({
  results,
  hasNextPage,
  isFetchingNextPage,
  nextPageError,
  fetchNextPage,
  matchedSkills,
  selectedId,
  onOpen,
  onPrefetch,
  animateIntro = false,
}: {
  results: SearchResult[]
  hasNextPage: boolean
  isFetchingNextPage: boolean
  nextPageError: boolean
  fetchNextPage: () => void
  matchedSkills: ReadonlySet<string>
  /** The candidate open in the sheet. */
  selectedId: string | null
  onOpen: (id: string) => void
  onPrefetch: (id: string) => void
  animateIntro?: boolean
}) {
  const listRef = useRef<HTMLDivElement>(null)
  const shortlisted = useShortlistedIds()
  const [scrollMargin, setScrollMargin] = useState(0)

  // The list's offset from the top of the page, kept current as content above it (chips, notes) changes.
  useLayoutEffect(() => {
    const el = listRef.current
    if (!el) return
    const measure = () => setScrollMargin(el.getBoundingClientRect().top + window.scrollY)
    const observer = new ResizeObserver(measure)
    observer.observe(document.body)
    return () => observer.disconnect()
  }, [])

  const showLoaderRow = hasNextPage && !nextPageError
  const virtualizer = useWindowVirtualizer({
    count: results.length + (showLoaderRow ? 1 : 0),
    estimateSize: () => 132,
    overscan: 6,
    scrollMargin,
  })
  const items = virtualizer.getVirtualItems()
  const lastIndex = items.at(-1)?.index ?? -1

  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage && !nextPageError && lastIndex >= results.length - PREFETCH_ROWS) {
      fetchNextPage()
    }
  }, [lastIndex, results.length, hasNextPage, isFetchingNextPage, nextPageError, fetchNextPage])

  // Keep the open candidate in view as the sheet steps through results (no-op when it already is).
  const selectedIndex = selectedId === null ? -1 : results.findIndex((r) => r.id === selectedId)
  useEffect(() => {
    if (selectedIndex >= 0) virtualizer.scrollToIndex(selectedIndex, { align: "auto" })
  }, [selectedIndex, virtualizer])

  return (
    <>
      <CandidateCardList ref={listRef} className="relative block" style={{ height: virtualizer.getTotalSize() }}>
        {items.map((item) => {
          const candidate = results[item.index]
          const intro = animateIntro && item.index < INTRO_ROWS
          return (
            <div
              key={item.key}
              data-index={item.index}
              ref={virtualizer.measureElement}
              // The gap lives in the wrapper so measured heights include it.
              className="absolute inset-x-0 top-0 pb-2"
              style={{ transform: `translateY(${item.start - virtualizer.options.scrollMargin}px)` }}
            >
              <div
                className={intro ? "animate-fade-up" : undefined}
                style={intro ? { animationDelay: `${Math.min(item.index * INTRO_STAGGER_MS, INTRO_MAX_DELAY_MS)}ms` } : undefined}
              >
                {candidate ? (
                  <CandidateCard
                    candidate={candidate}
                    rank={item.index + 1}
                    onOpen={onOpen}
                    onPrefetch={onPrefetch}
                    selected={candidate.id === selectedId}
                    shortlisted={shortlisted.has(candidate.id)}
                    renderShortlist={renderShortlistMenu}
                    matchedSkills={matchedSkills}
                    priority={item.index < 2}
                  />
                ) : (
                  <CandidateCardSkeleton />
                )}
              </div>
            </div>
          )
        })}
      </CandidateCardList>
      {nextPageError && (
        <ErrorState
          variant="inline"
          message="Couldn't load more results."
          onRetry={fetchNextPage}
          retrying={isFetchingNextPage}
          className="mt-3"
        />
      )}
    </>
  )
}
