"use client"

import type { Route } from "next"
import { SearchXIcon } from "lucide-react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { EmptyState } from "@/components/empty-state"
import { ErrorState } from "@/components/error-state"
import { SearchBar } from "@/components/search-bar"
import { toast, toastUndo } from "@/components/toast"
import { Button } from "@/components/ui/button"
import { CandidateSheetContainer } from "@/features/people/components/candidate-sheet-container"
import { usePrefetchPerson } from "@/features/people/hooks"
import { usePersonParam } from "@/features/people/use-person-param"
import { SearchQuota } from "@/features/plan/components/search-quota"
import { useUpgradeStore } from "@/features/plan/store"
import { SaveSearchButton } from "@/features/saved-briefs/components/save-search-button"
import { ApiError } from "@/lib/api-client"
import { formatCorrection, type Filters } from "@/lib/schemas/filters"
import { type SearchRequest, searchIdSchema } from "@/lib/schemas/search"
import { type Chip, type ConstraintKey, matchedSkillsOf, withFilter } from "../filter-model"
import { useRunSearch, useSearchPages } from "../hooks"
import { useSearchUiStore } from "../store"
import { SearchFilters } from "./search-filters"
import { SearchResults } from "./search-results"
import { FirstVisit, PendingStatus, ResultsSkeleton, useRotatingExample, ZeroResults } from "./search-states"

/** Rapid chip edits (toggling several values) collapse into one search. */
const EDIT_DEBOUNCE_MS = 300

/** Errors about the brief itself are shown under the field; everything else replaces the results. */
const isInputError = (e: unknown) => e instanceof ApiError && (e.status === 400 || e.status === 422)

/**
 * The search experience: brief → "We understood" chips → ranked, virtualized results. The current search
 * lives in the URL (`?s=<search_id>`) so refresh and back work; the snapshot is read from React Query.
 */
export function SearchPage() {
  const router = useRouter()
  const pathname = usePathname()
  const raw = useSearchParams().get("s")
  const searchId = raw !== null && searchIdSchema.safeParse(raw).success ? raw : null
  const badId = raw !== null && searchId === null

  const pagesQuery = useSearchPages(searchId)
  const person = usePersonParam()
  const prefetchPerson = usePrefetchPerson()
  const run = useRunSearch()
  const openUpgrade = useUpgradeStore((s) => s.open)
  const lastEdited = useSearchUiStore((s) => s.lastEdited)
  const setLastEdited = useSearchUiStore((s) => s.setLastEdited)

  const pages = pagesQuery.data?.pages
  const current = pages?.[0]
  const results = useMemo(() => pages?.flatMap((p) => p.results) ?? [], [pages])
  const resultIds = useMemo(() => results.map((r) => r.id), [results])

  // The brief field follows the search in the URL (refresh, back/forward), without clobbering typing.
  const [brief, setBrief] = useState("")
  const [syncedId, setSyncedId] = useState<string | null>(null)
  if (current && current.search_id !== syncedId) {
    setSyncedId(current.search_id)
    setBrief(current.brief)
  }

  // Chip edits show immediately; the re-run is debounced.
  const [draft, setDraft] = useState<Filters | null>(null)
  const filters = draft ?? current?.filters
  const matchedSkills = useMemo(() => matchedSkillsOf(current?.filters ?? {}), [current?.filters])

  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  /** The "Removed … · Undo" toast of the edit in flight; dismissed if that edit never ran. */
  const undoToast = useRef<string | number | undefined>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])

  const start = useCallback(
    (input: SearchRequest) => {
      run.mutate(input, {
        onSuccess: (res) => {
          setDraft(null)
          router.push(`${pathname}?s=${res.search_id}` as Route)
        },
        onError: (err) => {
          if (err instanceof ApiError && err.status === 402) {
            setDraft(null)
            // sonner's dismiss() without an id clears every toast.
            if (undoToast.current !== undefined) toast.dismiss(undoToast.current)
            openUpgrade("quota")
          }
        },
      })
    },
    // `run.mutate` is stable; listing `run` would re-create this every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [run.mutate, router, pathname, openUpgrade],
  )

  const submitBrief = useCallback(
    (text: string) => {
      clearTimeout(timer.current)
      setDraft(null)
      setLastEdited(null)
      setBrief(text)
      start({ brief: text })
    },
    [start, setLastEdited],
  )

  const runBrief = current?.brief
  const editFilters = useCallback(
    (next: Filters, edited: ConstraintKey | null) => {
      if (!runBrief) return
      // The model's one-line interpretation describes the original brief, not the edit.
      const rest = withFilter(next, "interpretation", undefined)
      setDraft(rest)
      setLastEdited(edited)
      clearTimeout(timer.current)
      timer.current = setTimeout(() => start({ brief: runBrief, filters: rest }), EDIT_DEBOUNCE_MS)
    },
    [runBrief, start, setLastEdited],
  )

  const removeChip = useCallback(
    (chip: Chip) => {
      if (!filters) return
      const before = filters
      editFilters(withFilter(filters, chip.key, undefined), null)
      undoToast.current = toastUndo(`Removed ${chip.label.toLowerCase()} filter`, () => editFilters(before, chip.key))
    },
    [filters, editFilters],
  )

  const removeUnsupported = useCallback(
    (item: string) => {
      if (!filters) return
      editFilters(withFilter(filters, "unsupported", (filters.unsupported ?? []).filter((u) => u !== item)), null)
    },
    [filters, editFilters],
  )

  const { fetchNextPage } = pagesQuery
  // Never cancel a page already in flight: the list may ask again before `isFetchingNextPage` flips.
  const loadMore = useCallback(() => void fetchNextPage({ cancelRefetch: false }), [fetchNextPage])
  const placeholder = useRotatingExample(brief === "")

  const runError = run.isError && !isInputError(run.error) && !(run.error instanceof ApiError && run.error.status === 402)
  const notFound = badId || (pagesQuery.error instanceof ApiError && pagesQuery.error.status === 404)

  let body: React.ReactNode
  if (run.isPending) {
    body = <ResultsSkeleton chips={!run.variables?.filters} />
  } else if (runError) {
    body = (
      <ErrorState
        title="Search didn't finish"
        message={run.error.message}
        onRetry={() => run.variables && start(run.variables)}
      />
    )
  } else if (notFound) {
    body = (
      <EmptyState
        icon={SearchXIcon}
        title="This search isn't available"
        description="It may belong to another account, or the link is incomplete."
        action={
          <Button variant="outline" onClick={() => router.push(pathname as Route)}>
            Start a new search
          </Button>
        }
      />
    )
  } else if (!searchId) {
    body = <FirstVisit onExample={submitBrief} />
  } else if (pagesQuery.isPending) {
    body = <ResultsSkeleton />
  } else if (pagesQuery.isError && !current) {
    body = (
      <ErrorState
        title="Couldn't load this search"
        message={pagesQuery.error.message}
        onRetry={() => pagesQuery.refetch()}
        retrying={pagesQuery.isFetching}
      />
    )
  } else if (current && filters) {
    body = (
      <div className="space-y-4">
        <SearchFilters
          filters={filters}
          onEdit={editFilters}
          onRemove={removeChip}
          onRemoveUnsupported={removeUnsupported}
        />
        <Notes filters={current.filters} />
        {current.total === 0 ? (
          <ZeroResults
            filters={current.filters}
            lastEdited={lastEdited}
            onRemove={removeChip}
            onDropUnsupported={() => editFilters(withFilter(current.filters, "unsupported", []), null)}
          />
        ) : (
          <SearchResults
            results={results}
            hasNextPage={pagesQuery.hasNextPage}
            isFetchingNextPage={pagesQuery.isFetchingNextPage}
            nextPageError={pagesQuery.isFetchNextPageError}
            fetchNextPage={loadMore}
            matchedSkills={matchedSkills}
            selectedId={person.personId}
            onOpen={person.open}
            onPrefetch={prefetchPerson}
          />
        )}
      </div>
    )
  }

  const total = current?.total
  // Saves what is on screen: the brief the results are for and the filters as edited (including a pending edit).
  const saveable = current !== undefined && !notFound && !run.isPending
  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-10 sm:px-6">
      <h1 className="sr-only">Search candidates</h1>
      {/* Sticky below the mobile top bar (h-14); at the top of the page from md up. */}
      <div className="sticky top-14 z-20 -mx-4 bg-background px-4 pt-4 pb-3 sm:-mx-6 sm:px-6 md:top-0 md:pt-8">
        <SearchBar
          value={brief}
          onChange={setBrief}
          onSubmit={submitBrief}
          loading={run.isPending}
          error={run.isError && isInputError(run.error) ? run.error.message : null}
          placeholder={`e.g. ${placeholder}`}
          autoFocus={!raw}
        />
        <div className="mt-3 flex min-h-8 items-center justify-between gap-3">
          <p aria-live="polite" className="min-w-0 px-1 text-sm text-muted-foreground tabular-nums">
            {run.isPending ? (
              <PendingStatus key={run.submittedAt} usesModel={!run.variables?.filters} />
            ) : draft ? (
              "Updating…"
            ) : total !== undefined && !notFound ? (
              `${total.toLocaleString()} ${total === 1 ? "person" : "people"}`
            ) : null}
          </p>
          <div className="flex shrink-0 items-center gap-3">
            {/* Below sm the plan badge sits in the top bar directly above, so the quota isn't repeated here. */}
            <SearchQuota className="max-sm:hidden" />
            <SaveSearchButton brief={saveable ? current.brief : undefined} filters={saveable ? filters : undefined} />
          </div>
        </div>
      </div>
      {body}
      <CandidateSheetContainer
        personId={person.personId}
        onClose={person.close}
        onStep={person.step}
        ids={resultIds}
        total={current?.total}
        hasMore={pagesQuery.hasNextPage}
        onLoadMore={loadMore}
        matchedSkills={matchedSkills}
      />
    </div>
  )
}

/** Quiet one-liners: how the brief was read, typo fixes and nice-to-haves that don't filter. */
function Notes({ filters }: { filters: Filters }) {
  const lines = [
    filters.interpretation,
    filters.corrections?.length ? `Read as ${filters.corrections.map(formatCorrection).join(", ")}.` : null,
    filters.preferences?.length ? `Nice to have, not filtered: ${filters.preferences.join(", ")}.` : null,
  ].filter(Boolean)
  if (lines.length === 0) return null
  return <p className="px-1 text-sm text-pretty text-muted-foreground">{lines.join(" · ")}</p>
}
