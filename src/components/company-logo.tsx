"use client"

import { Building2Icon } from "lucide-react"
import Image from "next/image"
import { useState } from "react"
import { cn } from "@/lib/utils"

const SIZES = { xs: 16, sm: 20, md: 32, lg: 40 } as const

/** Company mark on a white tile with a hairline, so logos read the same in light and dark. */
export function CompanyLogo({
  src,
  company,
  size = "sm",
  className,
}: {
  src: string | null
  company: string
  size?: keyof typeof SIZES
  className?: string
}) {
  const [failed, setFailed] = useState(false)
  const px = SIZES[size]
  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden bg-white",
        "after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:ring-1 after:ring-gray-950/10 after:ring-inset",
        px <= 20 ? "rounded-[4px]" : "rounded-md",
        className,
      )}
      style={{ width: px, height: px }}
      title={company}
    >
      {src && !failed ? (
        <Image
          src={src}
          alt={`${company} logo`}
          width={px}
          height={px}
          sizes={`${px}px`}
          className="size-full object-contain"
          onError={() => setFailed(true)}
        />
      ) : (
        <Building2Icon aria-label={company} className="size-[60%] text-gray-400" />
      )}
    </span>
  )
}
