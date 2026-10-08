import { cn } from "@/lib/utils"

/**
 * Neutral data label (skills, company type). Never interactive, never coloured — status uses Badge.
 * `matched` highlights a value that satisfied the recruiter's filter (accent tint = selection).
 */
export function Tag({
  className,
  matched = false,
  ...props
}: React.ComponentProps<"span"> & { matched?: boolean }) {
  return (
    <span
      data-matched={matched || undefined}
      className={cn(
        "inline-flex h-6 max-w-full shrink-0 items-center truncate rounded-full border border-border px-2.5 text-xs text-muted-foreground",
        matched && "border-transparent bg-primary-subtle font-medium text-primary-subtle-foreground",
        className,
      )}
      {...props}
    />
  )
}
