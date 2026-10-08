"use client"

import { AlertCircleIcon, RotateCwIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/**
 * Something failed: say what in plain language, offer Retry (wire it to React Query `refetch`).
 * `inline` is a one-line banner for small areas (sidebar lists, sheet sections).
 */
export function ErrorState({
  title = "Something went wrong",
  message,
  onRetry,
  retrying = false,
  variant = "block",
  className,
}: {
  title?: string
  message?: string
  onRetry?: () => void
  retrying?: boolean
  variant?: "block" | "inline"
  className?: string
}) {
  if (variant === "inline") {
    return (
      <div
        role="alert"
        className={cn(
          "flex items-center gap-2 rounded-md border border-destructive/20 bg-destructive-subtle px-3 py-2 text-sm",
          className,
        )}
      >
        <AlertCircleIcon aria-hidden className="size-4 shrink-0 text-destructive" />
        <span className="min-w-0 flex-1 truncate">{message ?? title}</span>
        {onRetry && (
          <Button variant="ghost" size="xs" onClick={onRetry} disabled={retrying}>
            <RotateCwIcon className={cn(retrying && "animate-spin")} />
            Retry
          </Button>
        )}
      </div>
    )
  }

  return (
    <div role="alert" className={cn("flex flex-col items-center gap-3 px-6 py-16 text-center", className)}>
      <span className="mb-1 flex size-11 items-center justify-center rounded-lg border border-destructive/20 bg-destructive-subtle text-destructive">
        <AlertCircleIcon aria-hidden className="size-5" />
      </span>
      <p className="text-lg font-medium">{title}</p>
      {message && <p className="max-w-sm text-sm text-pretty text-muted-foreground">{message}</p>}
      {onRetry && (
        <Button variant="outline" onClick={onRetry} disabled={retrying} className="mt-2">
          <RotateCwIcon className={cn(retrying && "animate-spin")} />
          {retrying ? "Retrying…" : "Retry"}
        </Button>
      )}
    </div>
  )
}
