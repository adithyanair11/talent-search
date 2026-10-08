"use client"

import { useWindowVirtualizer } from "@tanstack/react-virtual"
import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { CandidateList, CandidateRow, CandidateRowSkeleton } from "@/components/candidate-row"
import { ErrorState } from "@/components/error-state"
import type { SearchResult } from "@/lib/schemas/search"
import { useSearchUiStore } from "../store"

/** Load the next page when the last rendered row is this close to the end of what's loaded. */
const PREFETCH_ROWS = 8

/**
 * Ranked results, virtualized against the window (the page scrolls, so the search bar can stay sticky).
 * Pages load on demand from the stored snapshot; the next page is fetched before the end is reached.
 */
export function SearchResults({
  results,
  hasNextPage,
  isFetchingNextPage,
  nextPageError,
  fetchNextPage,
  matchedSkills,
}: {
  results: SearchResult[]
  hasNextPage: boolean
  isFetchingNextPage: boolean
  nextPageError: boolean
  fetchNextPage: () => void
  matchedSkills: ReadonlySet<string>
}) {
  const listRef = useRef<HTMLDivElement>(null)
  const [scrollMargin, setScrollMargin] = useState(0)
  const selectedId = useSearchUiStore((s) => s.selectedId)
  const select = useSearchUiStore((s) => s.select)

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
    estimateSize: () => 116,
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

  return (
    <>
      <CandidateList ref={listRef} className="relative" style={{ height: virtualizer.getTotalSize() }}>
        {items.map((item) => {
          const candidate = results[item.index]
          return (
            <div
              key={item.key}
              data-index={item.index}
              ref={virtualizer.measureElement}
              className="absolute inset-x-0 top-0"
              style={{ transform: `translateY(${item.start - virtualizer.options.scrollMargin}px)` }}
            >
              {candidate ? (
                <CandidateRow
                  candidate={candidate}
                  rank={item.index + 1}
                  onOpen={select}
                  selected={candidate.id === selectedId}
                  matchedSkills={matchedSkills}
                  priority={item.index < 2}
                />
              ) : (
                <CandidateRowSkeleton />
              )}
            </div>
          )
        })}
      </CandidateList>
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
