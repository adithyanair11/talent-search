import { CandidateAvatar } from "@/components/candidate-avatar"
import { cn } from "@/lib/utils"

/**
 * A few overlapping member avatars (a shortlist card). `total` beyond the shown avatars becomes a "+N" pill.
 * Decorative: the owner states the count in text.
 */
export function AvatarStack({
  urls,
  total = urls.length,
  className,
}: {
  urls: readonly string[]
  total?: number
  className?: string
}) {
  const extra = total - urls.length
  if (urls.length === 0) return null
  return (
    <span aria-hidden className={cn("flex items-center -space-x-1.5", className)}>
      {urls.map((url, i) => (
        <CandidateAvatar key={`${i}-${url}`} src={url} name="" size="sm" className="ring-2 ring-card" />
      ))}
      {extra > 0 && (
        <span className="relative inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-muted px-1.5 text-xs font-medium text-muted-foreground tabular-nums ring-2 ring-card">
          +{extra}
        </span>
      )}
    </span>
  )
}
