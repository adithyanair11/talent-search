import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * Nothing to show yet: icon, one sentence, one action. The sentence says what happened; the action
 * is the single most useful next step. `description` is for a short reason (e.g. unsupported filter).
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  size = "default",
  className,
}: {
  icon: LucideIcon
  title: string
  description?: React.ReactNode
  action?: React.ReactNode
  size?: "default" | "compact"
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center text-center",
        size === "default" ? "gap-3 px-6 py-16" : "gap-2 px-4 py-8",
        className,
      )}
    >
      <span
        className={cn(
          "flex items-center justify-center rounded-lg border border-border bg-background text-muted-foreground",
          size === "default" ? "mb-1 size-11" : "size-9",
        )}
      >
        <Icon aria-hidden className={size === "default" ? "size-5" : "size-4"} />
      </span>
      <p className={cn("max-w-sm font-medium text-balance", size === "default" ? "text-lg" : "text-base")}>
        {title}
      </p>
      {description && (
        <div className="max-w-sm text-sm text-pretty text-muted-foreground">{description}</div>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}
