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
        "inline-flex h-5 max-w-full shrink-0 items-center truncate rounded-[4px] border border-border px-1.5 text-xs text-muted-foreground",
        matched && "border-transparent bg-primary-subtle text-primary-subtle-foreground",
        className,
      )}
      {...props}
    />
  )
}
