"use client"

import { Loader2Icon, PlayIcon, Trash2Icon } from "lucide-react"
import { memo } from "react"
import { Tag } from "@/components/tag"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { chipsFor } from "@/features/search/filter-model"
import type { SavedBrief } from "@/lib/schemas/saved-briefs"

const DATE = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  year: "numeric",
})

/**
 * One saved search: the brief, a chip per filter, the saved date, and Run / Delete.
 * Memoised — pass stable `onRun` / `onDelete` that take the saved search.
 */
export const SavedBriefRow = memo(function SavedBriefRow({
  saved,
  running,
  disabled,
  onRun,
  onDelete,
}: {
  saved: SavedBrief
  /** This row's search is running. */
  running: boolean
  /** Another search is running. */
  disabled: boolean
  onRun: (saved: SavedBrief) => void
  onDelete: (saved: SavedBrief) => void
}) {
  const chips = chipsFor(saved.filters)
  return (
    <li className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-start sm:gap-4 sm:px-5">
      <div className="min-w-0 flex-1 space-y-2">
        <p className="line-clamp-2 font-medium text-pretty break-words">{saved.brief}</p>
        {chips.length > 0 && (
          <ul aria-label="Filters" className="flex flex-wrap gap-1.5">
            {chips.map((c) => (
              <li key={c.key} className="max-w-full">
                <Tag className="max-w-64" title={`${c.label}: ${c.value}`}>
                  {/* Tag is inline-flex, which can't ellipsize its own text. */}
                  <span className="truncate">
                    {c.label} · {c.value}
                  </span>
                </Tag>
              </li>
            ))}
          </ul>
        )}
        <p className="text-sm text-muted-foreground">
          Saved <time dateTime={saved.created_at}>{DATE.format(new Date(saved.created_at))}</time>
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2 sm:gap-1">
        <Button
          variant="outline"
          size="sm"
          className="max-sm:h-11 max-sm:flex-1"
          disabled={running || disabled}
          onClick={() => onRun(saved)}
          aria-label={`Run saved search: ${saved.brief}`}
        >
          {running ? <Loader2Icon aria-hidden className="animate-spin" /> : <PlayIcon aria-hidden />}
          {running ? "Running…" : "Run"}
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          className="text-muted-foreground max-sm:size-11"
          onClick={() => onDelete(saved)}
          aria-label={`Delete saved search: ${saved.brief}`}
        >
          <Trash2Icon aria-hidden />
        </Button>
      </div>
    </li>
  )
})

export function SavedBriefRowSkeleton() {
  return (
    <li className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-start sm:gap-4 sm:px-5">
      <div className="flex-1 space-y-2.5">
        <Skeleton className="h-4 w-4/5" />
        <div className="flex gap-1.5">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-5 w-28" />
        </div>
        <Skeleton className="h-3.5 w-24" />
      </div>
      <Skeleton className="h-11 w-full sm:h-8 sm:w-16" />
    </li>
  )
}
