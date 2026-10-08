"use client"

import { ChartNoAxesColumnIcon, CodeIcon, SearchXIcon, ServerIcon, XIcon } from "lucide-react"
import { useEffect, useState } from "react"
import { CandidateCardListSkeleton } from "@/components/candidate-card"
import type { ComposerSuggestion } from "@/components/composer"
import { EmptyState } from "@/components/empty-state"
import { THINKING_STEPS, ThinkingPanel, ThinkingSteps, useThinkingSteps } from "@/components/thinking-steps"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { ApiError } from "@/lib/api-client"
import type { Filters } from "@/lib/schemas/filters"
import { TOO_VAGUE_NOTE, unsupportedLabel } from "@/lib/unsupported"
import { type Chip, type ConstraintKey, chipsFor, hasConstraints } from "../filter-model"

/** One-click example briefs for the first visit. Generic, built from the data vocabulary. */
export const EXAMPLE_BRIEFS: readonly ComposerSuggestion[] = [
  { label: "Senior React engineers in New York who are open to work", icon: CodeIcon },
  { label: "Data scientists with Python and SQL, 5+ years", icon: ChartNoAxesColumnIcon },
  { label: "Backend engineers in Austin who know Go or Rust", icon: ServerIcon },
]

/** Rotating placeholder examples: short enough to fit on one line at 375px. */
const PLACEHOLDERS = [
  "Senior React engineers in NYC",
  "Data scientists, Python + SQL",
  "Go engineers in Austin",
  "Designers from startups",
  "Staff ML engineers with a PhD",
] as const

const ROTATE_MS = 3500

/** Cycles through placeholder examples while `active` (the field is empty). */
export function useRotatingExample(active: boolean): string {
  const [i, setI] = useState(0)
  useEffect(() => {
    if (!active) return
    const t = setInterval(() => setI((n) => (n + 1) % PLACEHOLDERS.length), ROTATE_MS)
    return () => clearInterval(t)
  }, [active])
  return PLACEHOLDERS[i]
}

/**
 * While a search runs: the pipeline steps (presentational, see ThinkingSteps) over cards shaped like the answer,
 * so nothing jumps when the results land. Edited-filter runs skip the model's two steps.
 */
export function SearchThinking({ running, usesModel }: { running: boolean; usesModel: boolean }) {
  const step = useThinkingSteps(running, usesModel)
  return (
    <div className="space-y-4">
      <ThinkingPanel>
        <ThinkingSteps active={step ?? THINKING_STEPS.length} usesModel={usesModel} />
      </ThinkingPanel>
      <CandidateCardListSkeleton rows={4} />
    </div>
  )
}

/** Count line + list skeleton while a stored search loads (refresh, back/forward). */
export function ResultsSkeleton() {
  return (
    <div className="space-y-3">
      <div className="flex h-10 items-center justify-between">
        <Skeleton className="h-4 w-40 rounded-full" />
        <Skeleton className="h-8 w-28 rounded-full" />
      </div>
      <CandidateCardListSkeleton rows={5} />
    </div>
  )
}

/** The 16px card that frames empty and error states in place of the results. */
export function StateCard({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl border border-border bg-card">{children}</div>
}

/** Plain-language copy for a search that didn't finish. 503 and 429 never use up a search (API contract). */
export function runErrorCopy(error: unknown): { title: string; message: string } {
  const status = error instanceof ApiError ? error.status : -1
  if (status === 503) {
    return {
      title: "Search is taking a breather",
      message: "We couldn't read your brief in time. Nothing was used from your plan, so just try again in a moment.",
    }
  }
  if (status === 429) {
    return {
      title: "That was a lot of searches at once",
      message: "Give it a few seconds, then try again. Nothing was used from your plan.",
    }
  }
  if (status === 0) {
    return { title: "You seem to be offline", message: "We couldn't reach the server. Check your connection and try again." }
  }
  return {
    title: "Search didn't finish",
    message: "Something went wrong on our side. Try again, and if it keeps happening, refresh the page.",
  }
}

/**
 * Zero results, explained: an unsupported requirement, nothing searchable, the filter just changed,
 * or the combination — each with a one-click way to widen the search.
 */
export function ZeroResults({
  filters,
  lastEdited,
  onRemove,
  onDropUnsupported,
}: {
  filters: Filters
  lastEdited: ConstraintKey | null
  onRemove: (chip: Chip) => void
  onDropUnsupported: () => void
}) {
  const unsupported = filters.unsupported ?? []
  const searchable = hasConstraints(filters)
  const missing = unsupported.filter((note) => note !== TOO_VAGUE_NOTE)

  if (unsupported.length > 0 && missing.length === 0) {
    return (
      <EmptyState
        icon={SearchXIcon}
        title="That's too broad to search"
        description="“Engineers” on its own matches most of our candidates. Add a role, skill, level, location or school."
      />
    )
  }

  if (missing.length > 0) {
    return (
      <EmptyState
        icon={SearchXIcon}
        title="Part of your brief isn't something we can search"
        description={
          <>
            Our candidate data doesn&apos;t include {quoteList(missing.map(unsupportedLabel))}, so rather than guess, we
            show no one.
            {!searchable && " Add a role, skill or location to search for."}
          </>
        }
        action={
          searchable && (
            <Button variant="outline" onClick={onDropUnsupported}>
              Search without {unsupported.length === 1 ? "it" : "them"}
            </Button>
          )
        }
      />
    )
  }

  if (!searchable) {
    return (
      <EmptyState
        icon={SearchXIcon}
        title="There's nothing here we can search for yet"
        description="Try naming a role, a skill, a city, a seniority level or a past company."
      />
    )
  }

  const chips = chipsFor(filters)
  const culprit = chips.find((c) => c.key === lastEdited)
  if (culprit) {
    return (
      <EmptyState
        icon={SearchXIcon}
        title={`No one matches after your change to ${culprit.label.toLowerCase()}`}
        description={`${culprit.label} · ${culprit.value} narrowed the results to zero.`}
        action={
          <Button variant="outline" onClick={() => onRemove(culprit)}>
            <XIcon />
            Remove {culprit.label.toLowerCase()} filter
          </Button>
        }
      />
    )
  }

  return (
    <EmptyState
      icon={SearchXIcon}
      title="No one matches all of these filters"
      description="Remove one to widen the search. You can also edit any filter above."
      action={
        <div className="flex flex-wrap justify-center gap-2">
          {chips.map((c) => (
            <Button key={c.key} variant="outline" size="sm" onClick={() => onRemove(c)} className="max-w-64 max-sm:h-11">
              <XIcon />
              <span className="truncate">
                {c.label} · {c.value}
              </span>
            </Button>
          ))}
        </div>
      }
    />
  )
}

function quoteList(items: readonly string[]): string {
  const q = items.map((s) => `“${s}”`)
  return q.length <= 1 ? (q[0] ?? "") : `${q.slice(0, -1).join(", ")} or ${q.at(-1)}`
}
