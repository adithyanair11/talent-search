"use client"

import type { Route } from "next"
import { SearchXIcon } from "lucide-react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { EmptyState } from "@/components/empty-state"
import { ErrorState } from "@/components/error-state"
import { Composer } from "@/components/composer"
import { FilterChipsSkeleton } from "@/components/filter-chip"
import { toast, toastUndo } from "@/components/toast"
import { Button } from "@/components/ui/button"
import { CandidateSheetContainer } from "@/features/people/components/candidate-sheet-container"
import { usePrefetchPerson } from "@/features/people/hooks"
import { usePersonParam } from "@/features/people/use-person-param"
import { SearchQuota } from "@/features/plan/components/search-quota"
import { useUpgradeStore } from "@/features/plan/store"
import { SaveSearchButton } from "@/features/saved-briefs/components/save-search-button"
import { ApiError } from "@/lib/api-client"
import { formatCorrection, isUuid } from "@/lib/limits"
import type { Filters } from "@/lib/schemas/filters"
import type { SearchRequest } from "@/lib/schemas/search"
import { type Chip, type ConstraintKey, matchedSkillsOf, withFilter } from "../filter-model"
import { useRunSearch, useSearchPages } from "../hooks"
import { useSearchUiStore } from "../store"
import { SearchFilters } from "./search-filters"
import { SearchResults } from "./search-results"
import {
  EXAMPLE_BRIEFS,
  ResultsSkeleton,
  runErrorCopy,
  SearchThinking,
  StateCard,
  useRotatingExample,
  ZeroResults,
} from "./search-states"

/** Rapid chip edits (toggling several values) collapse into one search. */
const EDIT_DEBOUNCE_MS = 300

/** How long the entrance (chips pop in, cards rise) stays armed after a new brief's results land. */
const INTRO_MS = 1500

/** Errors about the brief itself are shown under the field; everything else replaces the results. */
const isInputError = (e: unknown) => e instanceof ApiError && (e.status === 400 || e.status === 422)

/**
 * The search experience (docs/design.md §3): a centred hero composer on the first visit; after a submit the
 * composer docks to the top, the thinking steps play, the "Understood" chips pop in and ranked cards rise in.
 * The current search lives in the URL (`?s=<search_id>`) so refresh and back work; the snapshot is read from
 * React Query.
 */
export function SearchPage() {
  const router = useRouter()
  const pathname = usePathname()
  const raw = useSearchParams().get("s")
  const searchId = raw !== null && isUuid(raw) ? raw : null
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

  // The search whose entrance is playing: set when a new brief's results land, never for edits or reloads.
  const [introId, setIntroId] = useState<string | null>(null)
  useEffect(() => {
    if (introId === null) return
    const t = setTimeout(() => setIntroId(null), INTRO_MS)
    return () => clearTimeout(t)
  }, [introId])

  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  /** The "Removed … · Undo" toast of the edit in flight; dismissed if that edit never ran. */
  const undoToast = useRef<string | number | undefined>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])

  const start = useCallback(
    (input: SearchRequest) => {
      run.mutate(input, {
        onSuccess: (res) => {
          setDraft(null)
          if (!input.filters) setIntroId(res.search_id)
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

  /** "Clear all": back to the empty composer for a fresh brief (nothing is run or consumed). */
  const startOver = useCallback(() => {
    clearTimeout(timer.current)
    setDraft(null)
    setLastEdited(null)
    setBrief("")
    router.push(pathname as Route)
  }, [router, pathname, setLastEdited])

  const { fetchNextPage } = pagesQuery
  // Never cancel a page already in flight: the list may ask again before `isFetchingNextPage` flips.
  const loadMore = useCallback(() => void fetchNextPage({ cancelRefetch: false }), [fetchNextPage])
  const placeholder = useRotatingExample(brief === "")

  const runError = run.isError && !isInputError(run.error) && !(run.error instanceof ApiError && run.error.status === 402)
  const notFound = badId || (pagesQuery.error instanceof ApiError && pagesQuery.error.status === 404)

  const hero = !searchId && !badId && !run.isPending && !runError
  const inputError = run.isError && isInputError(run.error) ? run.error.message : null

  if (hero) {
    return (
      // Off-centre (≈ 30% from the top), like an LLM tool's empty chat.
      <div className="mx-auto flex w-full max-w-2xl flex-col px-4 pt-[10dvh] pb-12 sm:px-6 md:pt-[22dvh]">
        <Composer
          variant="hero"
          title="Who are you looking for?"
          description="Describe the person in plain English. We'll turn it into filters you can edit."
          value={brief}
          onChange={setBrief}
          onSubmit={submitBrief}
          error={inputError}
          placeholder={`e.g. ${placeholder}`}
          autoFocus={!raw}
          suggestions={EXAMPLE_BRIEFS}
          onSuggestion={submitBrief}
          meta={<SearchQuota />}
        />
      </div>
    )
  }

  const editing = run.isPending && Boolean(run.variables?.filters)
  const intro = current !== undefined && current.search_id === introId

  // Under the composer: the understood filters (skeleton pills while a new brief is being read).
  let chips: React.ReactNode = null
  if (run.isPending && !editing) {
    chips = <FilterChipsSkeleton />
  } else if (!notFound && !runError && filters && (editing || current)) {
    chips = (
      <SearchFilters
        filters={filters}
        onEdit={editFilters}
        onRemove={removeChip}
        onRemoveUnsupported={removeUnsupported}
        onClear={startOver}
        animateIn={intro && !draft}
      />
    )
  }

  let body: React.ReactNode
  if (run.isPending) {
    body = <SearchThinking running usesModel={!editing} />
  } else if (runError) {
    const copy = runErrorCopy(run.error)
    body = (
      <StateCard>
        <ErrorState title={copy.title} message={copy.message} onRetry={() => run.variables && start(run.variables)} />
      </StateCard>
    )
  } else if (notFound) {
    body = (
      <StateCard>
        <EmptyState
          icon={SearchXIcon}
          title="This search isn't available"
          description="It may belong to another account, or the link is incomplete."
          action={
            <Button variant="outline" onClick={startOver}>
              Start a new search
            </Button>
          }
        />
      </StateCard>
    )
  } else if (pagesQuery.isPending) {
    body = <ResultsSkeleton />
  } else if (pagesQuery.isError && !current) {
    body = (
      <StateCard>
        <ErrorState
          title="Couldn't load these results"
          message="Your search is saved. Check your connection and try again."
          onRetry={() => pagesQuery.refetch()}
          retrying={pagesQuery.isFetching}
        />
      </StateCard>
    )
  } else if (current && filters) {
    const total = current.total
    body = (
      <>
        <Notes filters={current.filters} />
        <div className="mb-3 flex min-h-10 items-center justify-between gap-3">
          <p aria-live="polite" className="min-w-0 px-1 text-sm text-muted-foreground tabular-nums">
            {draft ? (
              "Updating results…"
            ) : (
              <>
                <span className="font-semibold text-foreground">{total.toLocaleString()}</span>{" "}
                {total === 1 ? "candidate" : "candidates"}
                {total > 1 && <span className="max-sm:hidden"> · best match first</span>}
              </>
            )}
          </p>
          {/* Saves what is on screen: the brief the results are for and the filters as edited (including a pending edit). */}
          <SaveSearchButton brief={current.brief} filters={filters} />
        </div>
        {total === 0 ? (
          <StateCard>
            <ZeroResults
              filters={current.filters}
              lastEdited={lastEdited}
              onRemove={removeChip}
              onDropUnsupported={() => editFilters(withFilter(current.filters, "unsupported", []), null)}
            />
          </StateCard>
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
            animateIntro={intro}
          />
        )}
      </>
    )
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-10 sm:px-6">
      <h1 className="sr-only">Search candidates</h1>
      {/* The docked composer and the understood filters stay in view while the results scroll.
          Sticky below the mobile top bar (h-14); at the top of the page from md up. */}
      <div className="sticky top-14 z-20 -mx-4 bg-background/90 px-4 pt-3 pb-3 backdrop-blur-xl sm:-mx-6 sm:px-6 md:top-0 md:pt-6">
        <Composer
          value={brief}
          onChange={setBrief}
          onSubmit={submitBrief}
          loading={run.isPending}
          error={inputError}
          placeholder={`e.g. ${placeholder}`}
        />
        {/* Below sm the plan badge sits in the top bar directly above, so the quota isn't repeated here. */}
        <SearchQuota className="mt-2.5 justify-end px-1 max-sm:hidden" />
        {chips && <div className="mt-3">{chips}</div>}
      </div>
      <div className="mt-2">{body}</div>
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
  return <p className="mb-1 px-1 text-sm text-pretty text-muted-foreground">{lines.join(" · ")}</p>
}
