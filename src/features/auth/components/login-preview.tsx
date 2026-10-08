import { ArrowUpIcon, SparklesIcon } from "lucide-react"
import { cn } from "@/lib/utils"

const CHIPS = [
  ["Role", "Data Scientist"],
  ["Experience", "5+ yrs"],
  ["Skills", "Python, SQL"],
  ["Open to work", "Yes"],
] as const

/**
 * A still picture of the product beside the sign-in form (≥ lg): the docked composer, the "Understood" chips and
 * the shape of ranked results. Decorative only (aria-hidden, nothing focusable, no people or data), and static:
 * nothing loops on the login page.
 */
export function LoginPreview({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn("relative select-none", className)}>
      <div className="rounded-[28px] border border-border bg-surface p-6 xl:p-8">
        <p className="text-sm font-medium text-muted-foreground">How it works</p>
        <p className="mt-1 text-2xl font-semibold text-balance">Describe who you need. Get a ranked shortlist.</p>

        <div className="mt-6 flex items-center gap-2 rounded-2xl border border-border bg-card py-2 pr-2 pl-5 shadow-composer">
          <span className="min-w-0 flex-1 truncate text-lg">Data scientists with Python and SQL, 5+ years</span>
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[image:var(--accent-gradient)] text-primary-foreground">
            <ArrowUpIcon className="size-4" strokeWidth={2.25} />
          </span>
        </div>

        <p className="mt-5 mb-2.5 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <SparklesIcon className="size-3.5 text-primary" />
          Understood
        </p>
        <div className="flex flex-wrap gap-2">
          {CHIPS.map(([label, value]) => (
            <span key={label} className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border bg-card px-3 text-sm">
              <span className="text-muted-foreground">{label}</span>
              <span className="font-medium">{value}</span>
            </span>
          ))}
        </div>

        <p className="mt-6 mb-3 text-sm text-muted-foreground">
          <span className="font-semibold text-foreground tabular-nums">73</span> candidates · best match first
        </p>
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className={cn(
                "flex items-center gap-4 rounded-xl border border-border bg-card px-5 py-4",
                i === 2 && "opacity-60",
              )}
            >
              <span className="size-10 shrink-0 rounded-full bg-muted" />
              <span className="min-w-0 flex-1 space-y-2">
                <span className={cn("block h-3.5 rounded-full bg-foreground/15", i === 1 ? "w-28" : "w-36")} />
                <span className={cn("block h-3 rounded-full bg-muted", i === 1 ? "w-56" : "w-48")} />
                <span className="flex gap-1.5 pt-1">
                  <span className="h-5 w-14 rounded-full bg-primary-subtle" />
                  <span className="h-5 w-10 rounded-full bg-primary-subtle" />
                  <span className="h-5 w-12 rounded-full border border-border" />
                </span>
              </span>
              <span className="h-8 w-24 shrink-0 rounded-full border border-border" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
