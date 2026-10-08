"use client"

import { BookmarkIcon, Loader2Icon, MapPinIcon } from "lucide-react"
import { type ComponentProps, memo, type ReactNode } from "react"
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

export type CandidateCardProps = {
  candidate: CandidateSummary
  /** 1-based rank in the result set; shown on desktop. */
  rank?: number
  /** Open in the side sheet. Receives the id so the parent can pass a stable callback. */
  onOpen: (id: string) => void
  /** Warm the profile before it's opened (hover / keyboard focus). Receives the id; pass a stable callback. */
  onPrefetch?: (id: string) => void
  /** Currently open in the sheet. */
  selected?: boolean
  /** On at least one shortlist: passed to `renderShortlist` (keep it a boolean so memo holds). */
  shortlisted?: boolean
  /**
   * The card's shortlist control, usually `ShortlistIconButton` wrapped in a menu. Pass a stable function
   * (module level or `useCallback`) so the memoised card doesn't re-render.
   */
  renderShortlist?: (candidate: CandidateSummary, shortlisted: boolean) => ReactNode
  /** Skills that matched the search — highlighted and sorted first. */
  matchedSkills?: ReadonlySet<string>
  priority?: boolean
  /**
   * `card` (default): a standalone rounded card; stack them in `CandidateCardList`.
   * `row`: flat, for a hairline-divided `CandidateList` (shortlist pages, virtualised lists).
   */
  appearance?: "card" | "row"
}

/**
 * One ranked result: avatar, name, title · company, location, years and three key skills (matched first,
 * tinted). The whole card opens the sheet (stretched button on the name); the always-visible shortlist
 * control sits above it.
 * Memoised — pass stable callbacks.
 */
export const CandidateCard = memo(function CandidateCard({
  candidate: c,
  rank,
  onOpen,
  onPrefetch,
  selected = false,
  shortlisted = false,
  renderShortlist,
  matchedSkills,
  priority,
  appearance = "card",
}: CandidateCardProps) {
  const ordered = matchedSkills
    ? [...c.skills].sort((a, b) => Number(matchedSkills.has(b)) - Number(matchedSkills.has(a)))
    : c.skills
  const { visible, overflow } = topSkills(ordered, 3)
  const card = appearance === "card"

  return (
    <article
      aria-current={selected || undefined}
      onPointerEnter={onPrefetch && (() => onPrefetch(c.id))}
      onFocus={onPrefetch && (() => onPrefetch(c.id))}
      className={cn(
        "group/card relative flex gap-3 px-4 py-4 transition-[background-color,border-color,box-shadow] duration-200 sm:gap-4 sm:px-5",
        card
          ? "rounded-xl border border-border bg-card hover:border-border-strong hover:shadow-sm has-[button[data-row-open]:focus-visible]:border-border-strong has-[button[data-row-open]:focus-visible]:shadow-sm"
          : "hover:bg-accent has-[button[data-row-open]:focus-visible]:bg-accent",
        selected &&
          (card
            ? "border-primary/40 bg-primary-subtle ring-[3px] ring-primary/10 hover:border-primary/50"
            : "bg-primary-subtle hover:bg-primary-subtle"),
      )}
    >
      {selected && !card && <span aria-hidden className="absolute inset-y-0 left-0 w-0.5 bg-primary" />}
      {rank !== undefined && (
        <span
          aria-hidden
          className="hidden w-5 shrink-0 pt-3 text-right font-mono text-xs tabular-nums text-muted-foreground/70 md:block"
        >
          {rank}
        </span>
      )}
      <CandidateAvatar src={c.avatar_url} name={c.full_name} priority={priority} />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h3 className="truncate text-base font-semibold tracking-[-0.005em]">
            <button
              type="button"
              data-row-open
              onClick={() => onOpen(c.id)}
              className="outline-none after:absolute after:inset-0 after:rounded-[inherit] after:content-['']"
            >
              {c.full_name}
            </button>
          </h3>
          {c.open_to_work && (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-success-subtle px-1.5 py-px text-xs font-medium text-success">
              <span aria-hidden className="size-1.5 rounded-full bg-success" />
              Open to work
            </span>
          )}
        </div>

        {/* Mobile: title and company on separate lines; ≥ sm: one line. */}
        <p className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-muted-foreground sm:flex-nowrap">
          <span className="max-w-full truncate max-sm:basis-full">{c.current_title}</span>
          <span aria-hidden className="max-sm:hidden">
            at
          </span>
          <span className="flex min-w-0 items-center gap-1.5">
            <CompanyLogo
              src={c.current_company_logo_url}
              company={c.current_company}
              size="xs"
              className="pointer-events-none"
            />
            <span className="truncate font-medium text-foreground/85">{c.current_company}</span>
          </span>
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <MapPinIcon aria-hidden className="size-3.5" />
            {formatLocation(c.location)}
          </span>
          <span aria-hidden className="size-0.5 rounded-full bg-muted-foreground/50" />
          <span className="tabular-nums">{formatYears(c.years_experience)}</span>
          <span className="flex min-w-0 basis-full flex-wrap gap-1.5 sm:basis-auto">
            {visible.map((s) => (
              <Tag key={s} matched={matchedSkills?.has(s)}>
                {s}
                {matchedSkills?.has(s) && <span className="sr-only"> (matches your search)</span>}
              </Tag>
            ))}
            {overflow > 0 && <Tag className="tabular-nums">+{overflow}</Tag>}
          </span>
        </div>
      </div>

      {renderShortlist && (
        // Always visible: shortlisting is the main action on a result, so it must be obvious at first glance.
        <div className="relative z-10 -mt-1.5 -mr-1.5 shrink-0 self-start sm:mt-0 sm:mr-0">
          {renderShortlist(c, shortlisted)}
        </div>
      )}
    </article>
  )
})

/**
 * The shortlist control on a card: a "Shortlist" pill with a bookmark (icon-only, 44px, below `sm`). Tinted with a
 * filled bookmark and "Shortlisted" when the person is on any list (`aria-pressed`), a spinner while pending.
 * Forwards props and ref so a Popover / Drawer trigger can wrap it (`asChild`).
 */
export function ShortlistIconButton({
  name,
  shortlisted = false,
  pending = false,
  className,
  ...props
}: ComponentProps<"button"> & { name: string; shortlisted?: boolean; pending?: boolean }) {
  return (
    <button
      type="button"
      disabled={pending}
      aria-pressed={shortlisted}
      aria-label={shortlisted ? `${name} is shortlisted — change lists` : `Shortlist ${name}`}
      className={cn(
        "flex size-11 items-center justify-center gap-1.5 rounded-full border border-border bg-card text-sm font-medium text-muted-foreground transition-colors outline-none",
        "sm:h-8 sm:w-auto sm:pr-3 sm:pl-2.5",
        "hover:border-border-strong hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40",
        "data-[state=open]:border-border-strong data-[state=open]:text-foreground",
        shortlisted &&
          "border-primary/25 bg-primary-subtle text-primary-subtle-foreground hover:border-primary/40 hover:text-primary-subtle-foreground data-[state=open]:text-primary-subtle-foreground",
        className,
      )}
      {...props}
    >
      {pending ? (
        <Loader2Icon aria-hidden className="size-4 animate-spin" />
      ) : (
        <BookmarkIcon aria-hidden className={cn("size-4", shortlisted && "fill-current")} />
      )}
      <span aria-hidden className="max-sm:hidden">
        {shortlisted ? "Shortlisted" : "Shortlist"}
      </span>
    </button>
  )
}

export function CandidateCardSkeleton({ appearance = "card" }: { appearance?: "card" | "row" }) {
  return (
    <div
      aria-hidden
      className={cn(
        "flex gap-3 px-4 py-4 sm:gap-4 sm:px-5",
        appearance === "card" && "rounded-xl border border-border bg-card",
      )}
    >
      <Skeleton className="size-10 shrink-0 rounded-full" />
      <div className="flex-1 space-y-2 pt-0.5">
        <Skeleton className="h-4 w-40 rounded-full" />
        <Skeleton className="h-3.5 w-64 max-w-full rounded-full" />
        <div className="flex flex-wrap gap-2 pt-2">
          <Skeleton className="h-6 w-24 rounded-full" />
          <Skeleton className="h-6 w-12 rounded-full" />
          <Skeleton className="h-6 w-16 rounded-full" />
          <Skeleton className="h-6 w-14 rounded-full" />
        </div>
      </div>
    </div>
  )
}

/**
 * Stack of standalone cards (results). For a virtualised list, position each card absolutely and put the
 * gap in its wrapper (`pb-2`) so measured heights include it.
 */
export function CandidateCardList({ children, className, ...props }: React.ComponentProps<"div">) {
  return (
    <div className={cn("flex flex-col gap-2", className)} {...props}>
      {children}
    </div>
  )
}

export function CandidateCardListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <CandidateCardList role="status" aria-label="Loading candidates">
      {Array.from({ length: rows }, (_, i) => (
        <CandidateCardSkeleton key={i} />
      ))}
    </CandidateCardList>
  )
}
