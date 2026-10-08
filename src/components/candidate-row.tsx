"use client"

import { memo } from "react"
import {
  CandidateCard,
  type CandidateCardProps,
  CandidateCardSkeleton,
} from "@/components/candidate-card"
import { cn } from "@/lib/utils"

export { ShortlistIconButton } from "@/components/candidate-card"

/**
 * The flat (`row`) appearance of `CandidateCard`, for hairline-divided lists (shortlist pages and the
 * virtualised result list). Same props and memo contract as `CandidateCard`.
 */
export const CandidateRow = memo(function CandidateRow(props: Omit<CandidateCardProps, "appearance">) {
  return <CandidateCard {...props} appearance="row" />
})

export function CandidateRowSkeleton() {
  return <CandidateCardSkeleton appearance="row" />
}

/** Divided list container used for rows (results and shortlist members). */
export function CandidateList({ children, className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("divide-y divide-border overflow-hidden rounded-xl border border-border bg-card", className)}
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
