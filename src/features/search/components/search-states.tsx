"use client"

import { SearchIcon, SearchXIcon, XIcon } from "lucide-react"
import { useEffect, useState } from "react"
import { CandidateListSkeleton } from "@/components/candidate-row"
import { EmptyState } from "@/components/empty-state"
import { FilterChipsSkeleton } from "@/components/filter-chip"
import { Button } from "@/components/ui/button"
import type { Filters } from "@/lib/schemas/filters"
import { type Chip, type ConstraintKey, chipsFor, hasConstraints } from "../filter-model"

/** One-click example briefs for the first visit. Generic, built from the data vocabulary. */
export const EXAMPLE_BRIEFS = [
  "Senior React engineers in New York who are open to work",
  "Data scientists with Python and SQL, 5+ years",
  "Backend engineers in Austin who know Go or Rust",
] as const

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

/** First visit: what to type, plus one-click example briefs. */
export function FirstVisit({ onExample, disabled }: { onExample: (brief: string) => void; disabled?: boolean }) {
  return (
    <EmptyState
      icon={SearchIcon}
      title="Describe who you're looking for"
      description="Mention a role, level, skills, location, years of experience or past companies. We turn it into filters you can edit."
      action={
        <div className="flex flex-col items-stretch gap-2 sm:items-center">
          {EXAMPLE_BRIEFS.map((brief) => (
            <Button
              key={brief}
              variant="outline"
              disabled={disabled}
              onClick={() => onExample(brief)}
              className="h-auto min-h-11 justify-start px-3 py-2 text-left whitespace-normal sm:min-h-9"
            >
              {brief}
            </Button>
          ))}
        </div>
      }
    />
  )
}

/**
 * Status line while a search runs. Briefs go through the model first, so the message moves from
 * "Understanding…" to "Finding people…"; edited filters skip the model.
 */
export function PendingStatus({ usesModel }: { usesModel: boolean }) {
  const [understanding, setUnderstanding] = useState(usesModel)
  useEffect(() => {
    if (!usesModel) return
    const t = setTimeout(() => setUnderstanding(false), 1500)
    return () => clearTimeout(t)
  }, [usesModel])
  return <>{understanding ? "Understanding your brief…" : "Finding people…"}</>
}

export function ResultsSkeleton({ chips = true }: { chips?: boolean }) {
  return (
    <div className="space-y-4">
      {chips && <FilterChipsSkeleton />}
      <CandidateListSkeleton rows={5} />
    </div>
  )
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

  if (unsupported.length > 0) {
    return (
      <EmptyState
        icon={SearchXIcon}
        title="Part of your brief isn't in our data"
        description={
          <>
            We can&apos;t search by {quoteList(unsupported)}, so rather than guess we show no one.
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
        title="Nothing in this brief we can search for"
        description="Name a role, skill, location, level or company and we'll find matching people."
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
      description="Remove one to widen the search."
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
