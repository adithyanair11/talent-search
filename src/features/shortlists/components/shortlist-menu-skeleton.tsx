import { Skeleton } from "@/components/ui/skeleton"

/** Loading rows for the shortlist menu (while its chunk or the lists load). */
export function ShortlistMenuSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div role="status" aria-label="Loading shortlists" className="space-y-1 p-1">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex h-11 items-center gap-2 px-2 md:h-8">
          <Skeleton className="size-4 rounded-[4px]" />
          <Skeleton className={i % 2 ? "h-3.5 w-24" : "h-3.5 w-36"} />
        </div>
      ))}
    </div>
  )
}
