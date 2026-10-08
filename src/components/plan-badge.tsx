"use client"

import { SparklesIcon } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

export type Plan = { plan: "free" | "paid"; searches_remaining: number | null }

function label({ plan, searches_remaining }: Plan): React.ReactNode {
  if (plan === "paid") return "Pro"
  const n = searches_remaining ?? 0
  if (n === 0) return "0 searches left"
  // "search(es)" is dropped on narrow screens to fit the mobile top bar.
  return (
    <>
      {n}
      <span className="max-sm:hidden"> free search{n === 1 ? "" : "es"}</span> left
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
  if (!plan) return <Skeleton className={cn("h-8 w-36 rounded-full", className)} />

  const exhausted = plan.plan === "free" && (plan.searches_remaining ?? 0) === 0
  const base = cn(
    "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium whitespace-nowrap tabular-nums",
    plan.plan === "paid" && "border-transparent bg-primary text-primary-foreground",
    plan.plan === "free" && !exhausted && "border-border bg-card text-muted-foreground",
    exhausted && "border-transparent bg-warning-subtle text-warning",
    className,
  )

  if (plan.plan === "paid" || !onClick) {
    return (
      <span className={base} aria-live="polite">
        {plan.plan === "paid" && <SparklesIcon aria-hidden className="size-3" />}
        <span>{label(plan)}</span>
      </span>
    )
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-live="polite"
      className={cn(base, "pr-1 outline-none transition-colors hover:border-border-strong hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50")}
    >
      <SparklesIcon aria-hidden className={cn("size-3", exhausted ? "text-warning" : "text-primary")} />
      <span>{label(plan)}</span>
      <span className="ml-0.5 rounded-full bg-primary px-2 py-0.5 text-primary-foreground">Upgrade</span>
    </button>
  )
}
