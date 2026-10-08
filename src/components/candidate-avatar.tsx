"use client"

import Image from "next/image"
import { useState } from "react"
import { initials } from "@/lib/candidate"
import { cn } from "@/lib/utils"

const SIZES = { sm: 24, md: 40, lg: 64 } as const

/**
 * Candidate portrait. `priority` is for the few avatars above the fold: eager load at high fetch priority (Next 16
 * deprecates the `priority` prop on next/image). The muted circle is the colour placeholder while the image loads —
 * the sources are remote SVGs, which next/image serves as-is, so there is no blur data to show.
 * Real images carry the visual interest, so: no coloured fallbacks, a hairline
 * inner ring to separate light avatars from the background, and initials only when the image fails.
 */
export function CandidateAvatar({
  src,
  name,
  size = "md",
  priority = false,
  className,
}: {
  src: string | null
  name: string
  size?: keyof typeof SIZES
  priority?: boolean
  className?: string
}) {
  const [failed, setFailed] = useState(false)
  const px = SIZES[size]
  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted",
        "after:pointer-events-none after:absolute after:inset-0 after:rounded-full after:ring-1 after:ring-foreground/8 after:ring-inset",
        className,
      )}
      style={{ width: px, height: px }}
    >
      {src && !failed ? (
        <Image
          src={src}
          alt=""
          width={px}
          height={px}
          sizes={`${px}px`}
          loading={priority ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : "auto"}
          className="size-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <span
          aria-hidden
          className={cn(
            "font-medium text-muted-foreground select-none",
            size === "sm" ? "text-[10px]" : size === "md" ? "text-sm" : "text-xl",
          )}
        >
          {initials(name)}
        </span>
      )}
    </span>
  )
}
