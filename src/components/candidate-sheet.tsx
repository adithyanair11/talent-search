"use client"

import { MapPinIcon, XIcon } from "lucide-react"
import { CandidateAvatar } from "@/components/candidate-avatar"
import { CompanyLogo } from "@/components/company-logo"
import { ErrorState } from "@/components/error-state"
import { Tag } from "@/components/tag"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Drawer,
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
import { useIsDesktop } from "@/hooks/use-media-query"
import {
  type CandidateDetail,
  formatLocation,
  formatYearRange,
  formatYears,
} from "@/lib/candidate"
import { cn } from "@/lib/utils"

type CandidateSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  status: "pending" | "error" | "success"
  candidate?: CandidateDetail
  errorMessage?: string
  onRetry?: () => void
  retrying?: boolean
  /** Primary actions (e.g. shortlist picker). Rendered under the header. */
  actions?: React.ReactNode
  matchedSkills?: ReadonlySet<string>
}

/**
 * Candidate detail: right side sheet ≥ 768px, bottom drawer below. Heavy and opened on demand —
 * import it with `next/dynamic` from feature code.
 */
export function CandidateSheet(props: CandidateSheetProps) {
  const isDesktop = useIsDesktop()
  const { open, onOpenChange, candidate } = props
  const title = candidate?.full_name ?? "Candidate"
  const description = candidate ? `${candidate.current_title} at ${candidate.current_company}` : "Loading profile"

  if (isDesktop) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          showCloseButton={false}
          className="w-full gap-0 p-0 sm:max-w-[480px]"
        >
          <SheetTitle className="sr-only">{title}</SheetTitle>
          <SheetDescription className="sr-only">{description}</SheetDescription>
          <div className="flex h-12 shrink-0 items-center justify-end border-b border-border px-3">
            <SheetClose asChild>
              <Button variant="ghost" size="icon-sm" aria-label="Close">
                <XIcon />
              </Button>
            </SheetClose>
          </div>
          <div className="flex-1 overflow-y-auto overscroll-contain">
            <SheetBody {...props} />
          </div>
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[92dvh]">
        <DrawerTitle className="sr-only">{title}</DrawerTitle>
        <DrawerDescription className="sr-only">{description}</DrawerDescription>
        <div className="overflow-y-auto overscroll-contain pb-[env(safe-area-inset-bottom)]">
          <SheetBody {...props} />
        </div>
      </DrawerContent>
    </Drawer>
  )
}

function SheetBody({ status, candidate, errorMessage, onRetry, retrying, actions, matchedSkills }: CandidateSheetProps) {
  if (status === "pending") return <CandidateProfileSkeleton />
  if (status === "error" || !candidate) {
    return (
      <ErrorState
        title="Couldn't load this candidate"
        message={errorMessage ?? "Check your connection and try again."}
        onRetry={onRetry}
        retrying={retrying}
      />
    )
  }
  return <CandidateProfile candidate={candidate} actions={actions} matchedSkills={matchedSkills} />
}

function Section({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("px-5 py-5 sm:px-6", className)}>
      <h3 className="mb-3 text-sm font-medium text-muted-foreground">{title}</h3>
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
  return (
    <div className="divide-y divide-border">
      <header className="px-5 pt-4 pb-5 sm:px-6 sm:pt-6">
        <CandidateAvatar src={c.avatar_url} name={c.full_name} size="lg" priority />
        <h2 className="mt-4 text-xl font-semibold">{c.full_name}</h2>
        <p className="mt-1 flex items-center gap-1.5 text-base text-muted-foreground">
          <span className="truncate">{c.current_title}</span>
          <span aria-hidden>·</span>
          <CompanyLogo src={c.current_company_logo_url} company={c.current_company} size="xs" />
          <span className="truncate text-foreground">{c.current_company}</span>
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <MapPinIcon aria-hidden className="size-3.5" />
            {formatLocation(c.location)}
          </span>
          <span className="tabular-nums">{formatYears(c.years_experience)} experience</span>
          {c.open_to_work && <Badge variant="success">Open to work</Badge>}
        </div>
        {actions && <div className="mt-5 flex flex-wrap gap-2">{actions}</div>}
      </header>

      <Section title="Skills">
        <div className="flex flex-wrap gap-1.5">
          {c.skills.map((s) => (
            <Tag key={s} matched={matchedSkills?.has(s)} className="h-6 px-2 text-sm">
              {s}
            </Tag>
          ))}
        </div>
      </Section>

      <Section title="Experience">
        <ol className="space-y-5">
          {c.experiences.map((e, i) => (
            <li key={`${e.company}-${e.start_year}-${i}`} className="flex gap-3">
              <CompanyLogo src={e.company_logo_url} company={e.company} size="md" />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="truncate font-medium">{e.title}</p>
                  <p className="shrink-0 text-sm tabular-nums text-muted-foreground">
                    {formatYearRange(e.start_year, e.end_year)}
                  </p>
                </div>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {e.company}
                  <span className="capitalize"> · {e.company_type}</span>
                </p>
              </div>
            </li>
          ))}
        </ol>
      </Section>

      <Section title="Education">
        <ul className="space-y-3">
          {c.education.map((ed, i) => (
            <li key={`${ed.school}-${i}`} className="flex items-baseline justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-medium">{ed.school}</p>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {ed.degree}, {ed.field}
                </p>
              </div>
              <p className="shrink-0 text-sm tabular-nums text-muted-foreground">{ed.graduation_year}</p>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  )
}

export function CandidateProfileSkeleton() {
  return (
    <div role="status" aria-label="Loading candidate" className="divide-y divide-border">
      <div className="px-5 pt-4 pb-5 sm:px-6 sm:pt-6">
        <Skeleton className="size-16 rounded-full" />
        <Skeleton className="mt-4 h-6 w-48" />
        <Skeleton className="mt-2 h-4 w-64 max-w-full" />
        <Skeleton className="mt-3 h-4 w-40" />
        <Skeleton className="mt-5 h-9 w-36" />
      </div>
      <div className="px-5 py-5 sm:px-6">
        <Skeleton className="mb-3 h-4 w-12" />
        <div className="flex flex-wrap gap-1.5">
          {["w-16", "w-20", "w-14", "w-24", "w-16"].map((w, i) => (
            <Skeleton key={i} className={cn("h-6", w)} />
          ))}
        </div>
      </div>
      <div className="space-y-5 px-5 py-5 sm:px-6">
        <Skeleton className="h-4 w-20" />
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="size-8 shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-44" />
              <Skeleton className="h-3.5 w-28" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
