"use client"

import { SparklesIcon } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

export type Plan = { plan: "free" | "paid"; searches_remaining: number | null }

function label({ plan, searches_remaining }: Plan): React.ReactNode {
  if (plan === "paid") return "Paid"
  const n = searches_remaining ?? 0
  if (n === 0) return "No searches left"
  // "free" is dropped on narrow screens to fit the mobile top bar.
  return (
    <>
      {n}
      <span className="max-sm:hidden"> free</span> search{n === 1 ? "" : "es"} left
    </>
  )
}

/**
 * Plan + quota at a glance. Free plans are a button that opens the UpgradeDialog; paid is static.
 * Text, not colour alone, carries the state (warning tint only when the quota is exhausted).
 */
export function PlanBadge({
  plan,
  onClick,
  className,
}: {
  plan: Plan | undefined
  onClick?: () => void
  className?: string
}) {
  if (!plan) return <Skeleton className={cn("h-7 w-32 rounded-md", className)} />

  const exhausted = plan.plan === "free" && (plan.searches_remaining ?? 0) === 0
  const base = cn(
    "inline-flex h-7 items-center gap-1.5 rounded-md border px-2 text-xs font-medium whitespace-nowrap tabular-nums",
    plan.plan === "paid" && "border-transparent bg-primary-subtle text-primary-subtle-foreground",
    plan.plan === "free" && !exhausted && "border-border text-muted-foreground",
    exhausted && "border-transparent bg-warning-subtle text-warning",
    className,
  )

  if (plan.plan === "paid" || !onClick) {
    return (
      <span className={base} aria-live="polite">
        {plan.plan === "paid" && <SparklesIcon aria-hidden className="size-3" />}
        {label(plan)}
      </span>
    )
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-live="polite"
      className={cn(base, "outline-none transition-colors hover:border-border-strong hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50")}
    >
      <span className={cn("size-1.5 rounded-full", exhausted ? "bg-warning" : "bg-muted-foreground/50")} aria-hidden />
      {label(plan)}
      <span className="text-primary">· Upgrade</span>
    </button>
  )
}
