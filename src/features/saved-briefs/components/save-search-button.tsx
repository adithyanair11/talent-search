"use client"

import { BookmarkCheckIcon, BookmarkIcon, Loader2Icon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type { Filters } from "@/lib/schemas/filters"
import { useIsSaved, useSaveBrief } from "../hooks"

/**
 * "Save search" next to the result count. Saves the brief the results are for plus the filters as currently
 * edited. Disabled (with a tooltip saying why) until there is a search; shows "Saved" once this exact search is.
 */
export function SaveSearchButton({ brief, filters }: { brief?: string; filters?: Filters }) {
  const save = useSaveBrief()
  const saved = useIsSaved(brief, filters)
  const ready = brief !== undefined && filters !== undefined

  if (!ready) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          {/* A disabled button gets no pointer or focus events; the wrapper carries the hint. */}
          <span
            tabIndex={0}
            className="inline-flex rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <Button variant="ghost" size="sm" disabled className="max-md:h-11" tabIndex={-1}>
              <BookmarkIcon aria-hidden />
              Save search
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent>Run a search first, then save it to re-run later.</TooltipContent>
      </Tooltip>
    )
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className="max-md:h-11"
      disabled={saved || save.isPending}
      aria-label={saved ? "Search saved" : undefined}
      onClick={() => save.mutate({ brief, filters })}
    >
      {save.isPending ? (
        <Loader2Icon aria-hidden className="animate-spin" />
      ) : saved ? (
        <BookmarkCheckIcon aria-hidden />
      ) : (
        <BookmarkIcon aria-hidden />
      )}
      {saved ? "Saved" : "Save search"}
    </Button>
  )
}
