"use client"

import { ChevronDownIcon, ChevronUpIcon, MapPinIcon, XIcon } from "lucide-react"
import { CandidateAvatar } from "@/components/candidate-avatar"
import { CompanyLogo } from "@/components/company-logo"
import { ErrorState } from "@/components/error-state"
import { Kbd } from "@/components/kbd"
import { Tag } from "@/components/tag"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
} from "@/components/ui/drawer"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useIsDesktop } from "@/hooks/use-media-query"
import {
  type CandidateDetail,
  formatDuration,
  formatLocation,
  formatYearRange,
  formatYears,
  orderSkills,
} from "@/lib/candidate"
import { cn } from "@/lib/utils"

type CandidateSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  status: "pending" | "error" | "success"
  candidate?: CandidateDetail
  errorTitle?: string
  errorMessage?: string
  /** Omit when retrying can't help (e.g. the candidate doesn't exist). */
  onRetry?: () => void
  retrying?: boolean
  /** Primary actions (e.g. shortlist). In the header ≥ 768px; a sticky bottom bar below. */
  actions?: React.ReactNode
  matchedSkills?: ReadonlySet<string>
  /** Step through a result list (the owner also binds ←/→). Both omitted = no stepper; `null` = at that end. */
  onPrevious?: (() => void) | null
  onNext?: (() => void) | null
  /** e.g. "3 of 120", shown beside the stepper. */
  positionLabel?: string
}

/**
 * Candidate detail: right side sheet ≥ 768px, full-height bottom drawer below. Heavy and opened on demand —
 * import it with `next/dynamic` from feature code.
 */
export function CandidateSheet(props: CandidateSheetProps) {
  const isDesktop = useIsDesktop()
  const { open, onOpenChange, candidate, actions, status } = props
  const title = candidate?.full_name ?? "Candidate"
  const description = candidate?.headline ?? (status === "pending" ? "Loading profile" : "Profile unavailable")

  if (isDesktop) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          showCloseButton={false}
          onOpenAutoFocus={focusContainer}
          className="w-full gap-0 p-0 outline-none sm:max-w-[480px]"
        >
          <SheetTitle className="sr-only">{title}</SheetTitle>
          <SheetDescription className="sr-only">{description}</SheetDescription>
          <Toolbar {...props}>
            <SheetClose asChild>
              <Button variant="ghost" size="icon-sm" aria-label="Close">
                <XIcon />
              </Button>
            </SheetClose>
          </Toolbar>
          {/* Keyed by candidate so stepping to the next one starts at the top. */}
          <div key={candidate?.id} className="flex-1 overflow-y-auto overscroll-contain">
            <SheetBody {...props} showActions />
          </div>
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent
        onOpenAutoFocus={focusContainer}
        className={cn(
          "outline-none pt-[env(safe-area-inset-top)]",
          "data-[vaul-drawer-direction=bottom]:mt-0 data-[vaul-drawer-direction=bottom]:h-dvh data-[vaul-drawer-direction=bottom]:max-h-dvh",
        )}
      >
        <DrawerTitle className="sr-only">{title}</DrawerTitle>
        <DrawerDescription className="sr-only">{description}</DrawerDescription>
        <Toolbar {...props}>
          <DrawerClose asChild>
            <Button variant="ghost" size="icon" className="size-11" aria-label="Close">
              <XIcon />
            </Button>
          </DrawerClose>
        </Toolbar>
        <div key={candidate?.id} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <SheetBody {...props} showActions={false} />
        </div>
        {actions && status === "success" && (
          <div className="flex shrink-0 gap-2 border-t border-border bg-background px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] *:h-11 *:flex-1">
            {actions}
          </div>
        )}
      </DrawerContent>
    </Drawer>
  )
}

/**
 * Focus the sheet itself rather than its first button: Esc and ←/→ work straight away, and the stepper's tooltip
 * doesn't pop open on every open. Tab still enters the sheet, and focus returns to the row on close.
 */
function focusContainer(e: Event) {
  e.preventDefault()
  ;(e.currentTarget as HTMLElement).focus()
}

/** Close plus, when the owner provides it, the previous/next stepper. 44px targets below 768px. */
function Toolbar({
  onPrevious,
  onNext,
  positionLabel,
  children,
}: Pick<CandidateSheetProps, "onPrevious" | "onNext" | "positionLabel"> & { children: React.ReactNode }) {
  const stepper = onPrevious !== undefined || onNext !== undefined
  return (
    <div className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border px-2 md:h-12 md:px-3">
      {stepper ? (
        <div className="flex items-center gap-1">
          <StepButton label="Previous candidate" shortcut="←" onClick={onPrevious ?? undefined}>
            <ChevronUpIcon />
          </StepButton>
          <StepButton label="Next candidate" shortcut="→" onClick={onNext ?? undefined}>
            <ChevronDownIcon />
          </StepButton>
          {positionLabel && (
            <span aria-live="polite" className="ml-1 text-sm tabular-nums text-muted-foreground">
              {positionLabel}
            </span>
          )}
        </div>
      ) : (
        <span />
      )}
      {children}
    </div>
  )
}

function StepButton({
  label,
  shortcut,
  onClick,
  children,
}: {
  label: string
  shortcut: "←" | "→"
  onClick?: () => void
  children: React.ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-11 md:size-8"
          aria-label={label}
          aria-keyshortcuts={shortcut === "←" ? "ArrowLeft" : "ArrowRight"}
          onClick={onClick}
          disabled={!onClick}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {label} <Kbd>{shortcut}</Kbd>
      </TooltipContent>
    </Tooltip>
  )
}

function SheetBody({
  status,
  candidate,
  errorTitle,
  errorMessage,
  onRetry,
  retrying,
  actions,
  matchedSkills,
  showActions,
}: CandidateSheetProps & { showActions: boolean }) {
  if (status === "pending") return <CandidateProfileSkeleton />
  if (status === "error" || !candidate) {
    return (
      <ErrorState
        title={errorTitle ?? "Couldn't load this candidate"}
        message={errorMessage ?? "Check your connection and try again."}
        onRetry={onRetry}
        retrying={retrying}
      />
    )
  }
  return <CandidateProfile candidate={candidate} actions={showActions ? actions : undefined} matchedSkills={matchedSkills} />
}

function Section({ title, aside, children }: { title: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="px-5 py-5 sm:px-6">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  )
}

export function CandidateProfile({
  candidate: c,
  actions,
  matchedSkills,
}: {
  candidate: CandidateDetail
  actions?: React.ReactNode
  matchedSkills?: ReadonlySet<string>
}) {
  const skills = orderSkills(c.skills, matchedSkills)
  const matchedCount = matchedSkills ? c.skills.filter((s) => matchedSkills.has(s)).length : 0

  return (
    <div className="divide-y divide-border">
      <header className="px-5 pt-5 pb-5 sm:px-6 sm:pt-6">
        <CandidateAvatar src={c.avatar_url} name={c.full_name} size="lg" priority />
        <h2 className="mt-4 text-xl font-semibold text-balance">{c.full_name}</h2>
        <p className="mt-1 text-base text-pretty text-muted-foreground">{c.headline}</p>
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted-foreground">
          <span className="inline-flex min-w-0 items-center gap-1.5">
            <CompanyLogo src={c.current_company_logo_url} company={c.current_company} size="xs" />
            <span className="truncate text-foreground/80">{c.current_company}</span>
          </span>
          <span className="inline-flex items-center gap-1">
            <MapPinIcon aria-hidden className="size-3.5" />
            {formatLocation(c.location)}
          </span>
          <span className="tabular-nums">{formatYears(c.years_experience)} experience</span>
          {c.open_to_work && <Badge variant="success">Open to work</Badge>}
        </div>
        {actions && <div className="mt-5 flex flex-wrap gap-2">{actions}</div>}
      </header>

      <Section title="Experience">
        <ol>
          {c.experiences.map((e, i) => {
            const last = i === c.experiences.length - 1
            return (
              <li key={`${e.company}-${e.start_year}-${i}`} className={cn("relative flex gap-3", !last && "pb-5")}>
                {/* Timeline rail from under this logo to the next one. */}
                {!last && <span aria-hidden className="absolute top-10 bottom-1 left-4 w-px bg-border" />}
                <CompanyLogo src={e.company_logo_url} company={e.company} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-pretty">{e.title}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    <span className="text-foreground/80">{e.company}</span>
                    <span className="capitalize"> · {e.company_type}</span>
                  </p>
                  <p className="mt-0.5 text-sm tabular-nums text-muted-foreground">
                    {formatYearRange(e.start_year, e.end_year)} · {formatDuration(e.start_year, e.end_year)}
                  </p>
                  {e.description && <p className="mt-2 text-sm text-pretty">{e.description}</p>}
                </div>
              </li>
            )
          })}
        </ol>
      </Section>

      <Section title="Education">
        <ul className="space-y-3">
          {c.education.map((ed, i) => (
            <li key={`${ed.school}-${i}`} className="flex items-baseline justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium text-pretty">{ed.school}</p>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {ed.degree}, {ed.field}
                </p>
              </div>
              <p className="shrink-0 text-sm tabular-nums text-muted-foreground">{ed.graduation_year}</p>
            </li>
          ))}
        </ul>
      </Section>

      <Section
        title="Skills"
        aside={
          matchedCount > 0 && (
            <span className="text-xs tabular-nums text-muted-foreground">
              {matchedCount} {matchedCount === 1 ? "matches" : "match"} your search
            </span>
          )
        }
      >
        <ul className="flex flex-wrap gap-1.5">
          {skills.map((s) => {
            const matched = matchedSkills?.has(s) ?? false
            return (
              <li key={s} className="max-w-full">
                <Tag matched={matched} className="h-6 px-2 text-sm">
                  {s}
                  {matched && <span className="sr-only"> (matches your search)</span>}
                </Tag>
              </li>
            )
          })}
        </ul>
      </Section>
    </div>
  )
}

export function CandidateProfileSkeleton() {
  return (
    <div role="status" aria-label="Loading candidate" className="divide-y divide-border">
      <div className="px-5 pt-5 pb-5 sm:px-6 sm:pt-6">
        <Skeleton className="size-16 rounded-full" />
        <Skeleton className="mt-4 h-6 w-48" />
        <Skeleton className="mt-2 h-4 w-72 max-w-full" />
        <Skeleton className="mt-3 h-4 w-56 max-w-full" />
        <Skeleton className="mt-5 h-9 w-32 max-md:hidden" />
      </div>
      <div className="px-5 py-5 sm:px-6">
        <Skeleton className="mb-3 h-4 w-20" />
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex gap-3 pb-5 last:pb-0">
            <Skeleton className="size-8 shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-44" />
              <Skeleton className="h-3.5 w-28" />
              <Skeleton className="h-3.5 w-36" />
              <Skeleton className="mt-3 h-3.5 w-full" />
            </div>
          </div>
        ))}
      </div>
      <div className="space-y-2 px-5 py-5 sm:px-6">
        <Skeleton className="mb-3 h-4 w-20" />
        <Skeleton className="h-4 w-52" />
        <Skeleton className="h-3.5 w-36" />
      </div>
      <div className="px-5 py-5 sm:px-6">
        <Skeleton className="mb-3 h-4 w-12" />
        <div className="flex flex-wrap gap-1.5">
          {["w-16", "w-20", "w-14", "w-24", "w-16"].map((w, i) => (
            <Skeleton key={i} className={cn("h-6", w)} />
          ))}
        </div>
      </div>
    </div>
  )
}
