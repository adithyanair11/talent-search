"use client"

import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { usePlan } from "../hooks"
import { useUpgradeStore } from "../store"

/**
 * Free-plan quota next to the search bar: "1 free search left · Upgrade". Nothing on Pro. On error it stays out of
 * the way (the PlanBadge in the shell owns the retry).
 */
export function SearchQuota({ className }: { className?: string }) {
  const { data, isPending } = usePlan()
  const openUpgrade = useUpgradeStore((s) => s.open)

  if (isPending) return <Skeleton className={cn("h-4 w-28", className)} />
  if (!data || data.plan !== "free") return null

  const n = data.searches_remaining ?? 0
  return (
    <p className={cn("flex items-center gap-1 text-xs whitespace-nowrap text-muted-foreground tabular-nums", className)}>
      <span className={cn(n === 0 && "text-warning")}>
        {n === 0 ? "No free searches left" : `${n} free search${n === 1 ? "" : "es"} left`}
      </span>
      <span aria-hidden>·</span>
      <button
        type="button"
        onClick={() => openUpgrade(n === 0 ? "quota" : "manual")}
        className="-my-3 rounded-sm py-3 font-medium text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        Upgrade
      </button>
    </p>
  )
}
