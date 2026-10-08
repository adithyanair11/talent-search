"use client"

import { BookmarkIcon, Loader2Icon, MapPinIcon } from "lucide-react"
import { memo } from "react"
import { CandidateAvatar } from "@/components/candidate-avatar"
import { CompanyLogo } from "@/components/company-logo"
import { Tag } from "@/components/tag"
import { Skeleton } from "@/components/ui/skeleton"
import {
  type CandidateSummary,
  formatLocation,
  formatYears,
  topSkills,
} from "@/lib/candidate"
import { cn } from "@/lib/utils"

type CandidateRowProps = {
  candidate: CandidateSummary
  /** 1-based rank in the result set; shown on desktop. */
  rank?: number
  /** Open in the side sheet. Receives the id so the parent can pass a stable callback. */
  onOpen: (id: string) => void
  /** Warm the profile before it's opened (hover / keyboard focus). Receives the id; pass a stable callback. */
  onPrefetch?: (id: string) => void
  /** Currently open in the sheet. */
  selected?: boolean
  shortlisted?: boolean
  shortlistPending?: boolean
  onToggleShortlist?: (id: string) => void
  /** Skills that matched the search — highlighted and sorted first. */
  matchedSkills?: ReadonlySet<string>
  priority?: boolean
}

/**
 * One ranked result. The whole row opens the sheet (stretched link on the name button);
 * the shortlist button sits above it. Memoised — pass stable callbacks.
 */
export const CandidateRow = memo(function CandidateRow({
  candidate: c,
  rank,
  onOpen,
  onPrefetch,
  selected = false,
  shortlisted = false,
  shortlistPending = false,
  onToggleShortlist,
  matchedSkills,
  priority,
}: CandidateRowProps) {
  const ordered = matchedSkills
    ? [...c.skills].sort((a, b) => Number(matchedSkills.has(b)) - Number(matchedSkills.has(a)))
    : c.skills
  const { visible, overflow } = topSkills(ordered, 3)

  return (
    <article
      aria-current={selected || undefined}
      onPointerEnter={onPrefetch && (() => onPrefetch(c.id))}
      onFocus={onPrefetch && (() => onPrefetch(c.id))}
      className={cn(
        "group/row relative flex gap-3 px-4 py-4 transition-colors sm:gap-4 sm:px-5",
        "hover:bg-accent/60 has-[button[data-row-open]:focus-visible]:bg-accent/60",
        selected && "bg-primary-subtle hover:bg-primary-subtle",
      )}
    >
      {selected && <span aria-hidden className="absolute inset-y-0 left-0 w-0.5 bg-primary" />}
      {rank !== undefined && (
        <span
          aria-hidden
          className="hidden w-6 shrink-0 pt-2.5 text-right font-mono text-xs tabular-nums text-muted-foreground/70 md:block"
        >
          {rank}
        </span>
      )}
      <CandidateAvatar src={c.avatar_url} name={c.full_name} priority={priority} />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h3 className="truncate text-base font-medium">
            <button
              type="button"
              data-row-open
              onClick={() => onOpen(c.id)}
              className="outline-none after:absolute after:inset-0 after:content-['']"
            >
              {c.full_name}
            </button>
          </h3>
          {c.open_to_work && (
            <span className="inline-flex shrink-0 items-center gap-1 text-xs text-success">
              <span aria-hidden className="size-1.5 rounded-full bg-success" />
              Open to work
            </span>
          )}
        </div>

        {/* Mobile: title and company on separate lines; ≥ sm: one line. */}
        <p className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-muted-foreground sm:flex-nowrap">
          <span className="max-w-full truncate max-sm:basis-full">{c.current_title}</span>
          <span aria-hidden className="max-sm:hidden">
            ·
          </span>
          <span className="flex min-w-0 items-center gap-1.5">
            <CompanyLogo
              src={c.current_company_logo_url}
              company={c.current_company}
              size="xs"
              className="pointer-events-none"
            />
            <span className="truncate text-foreground/80">{c.current_company}</span>
          </span>
        </p>

        <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <MapPinIcon aria-hidden className="size-3.5" />
            {formatLocation(c.location)}
          </span>
          <span className="tabular-nums">{formatYears(c.years_experience)}</span>
          <span className="flex min-w-0 flex-wrap gap-1">
            {visible.map((s) => (
              <Tag key={s} matched={matchedSkills?.has(s)}>
                {s}
              </Tag>
            ))}
            {overflow > 0 && <Tag className="tabular-nums">+{overflow}</Tag>}
          </span>
        </div>
      </div>

      {onToggleShortlist && (
        <button
          type="button"
          onClick={() => onToggleShortlist(c.id)}
          disabled={shortlistPending}
          aria-pressed={shortlisted}
          aria-label={shortlisted ? `Remove ${c.full_name} from shortlist` : `Shortlist ${c.full_name}`}
          className={cn(
            "relative z-10 -mt-1 -mr-2 flex size-11 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors outline-none sm:size-9",
            "hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50",
            shortlisted && "text-primary hover:text-primary",
          )}
        >
          {shortlistPending ? (
            <Loader2Icon className="size-4 animate-spin" />
          ) : (
            <BookmarkIcon className={cn("size-4", shortlisted && "fill-current")} />
          )}
        </button>
      )}
    </article>
  )
})

export function CandidateRowSkeleton() {
  return (
    <div className="flex gap-3 px-4 py-4 sm:gap-4 sm:px-5" aria-hidden>
      <Skeleton className="size-10 shrink-0 rounded-full" />
      <div className="flex-1 space-y-2 pt-0.5">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-3.5 w-64 max-w-full" />
        <div className="flex gap-2 pt-1.5">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-5 w-12" />
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-5 w-14" />
        </div>
      </div>
    </div>
  )
}

/** Divided list container used for results and shortlist members. */
export function CandidateList({
  children,
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("divide-y divide-border overflow-hidden rounded-lg border border-border", className)}
      {...props}
    >
      {children}
    </div>
  )
}

export function CandidateListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <CandidateList role="status" aria-label="Loading candidates">
      {Array.from({ length: rows }, (_, i) => (
        <CandidateRowSkeleton key={i} />
      ))}
    </CandidateList>
  )
}
