"use client"

import { AlertTriangleIcon, PlusIcon, SparklesIcon, XIcon } from "lucide-react"
import { memo } from "react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Skeleton } from "@/components/ui/skeleton"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

type FilterChipProps = {
  label: string
  value: string
  /** Popover body used to edit the value. Omit for a read-only chip. */
  editor?: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
  onRemove?: () => void
  /** The brief asked for this but the data can't express it — shown, never applied. */
  unsupported?: boolean
  /** Short explanation shown on hover/focus of a read-only chip (e.g. why an unsupported term is ignored). */
  hint?: string
  disabled?: boolean
  /** Fade/rise in when it first appears (after a search). `index` staggers a row of chips by 40 ms each. */
  animateIn?: boolean
  index?: number
  className?: string
}

/**
 * One understood filter: `label · value`, click to edit in a popover, × to remove.
 * Removing is instant — the owner should offer Undo via `toastUndo`.
 */
export const FilterChip = memo(function FilterChip({
  label,
  value,
  editor,
  open,
  onOpenChange,
  onRemove,
  unsupported = false,
  hint,
  disabled = false,
  animateIn = false,
  index = 0,
  className,
}: FilterChipProps) {
  const body = (
    <>
      {unsupported && <AlertTriangleIcon aria-hidden className="size-3.5 shrink-0 text-warning" />}
      <span className="shrink-0 whitespace-nowrap text-muted-foreground">{label}</span>
      <span
        className={cn(
          "truncate font-medium text-foreground",
          unsupported && "text-muted-foreground line-through decoration-muted-foreground/50",
        )}
      >
        {value}
      </span>
    </>
  )

  return (
    <span
      data-unsupported={unsupported || undefined}
      style={animateIn ? { animationDelay: `${index * 40}ms` } : undefined}
      className={cn(
        "group/chip inline-flex h-8 max-w-full items-stretch overflow-hidden rounded-full border border-border bg-card text-sm transition-[border-color,box-shadow,background-color] max-sm:h-9",
        "hover:border-border-strong",
        "has-[[data-state=open]]:border-primary/60 has-[[data-state=open]]:bg-primary-subtle has-[[data-state=open]]:ring-[3px] has-[[data-state=open]]:ring-primary/12",
        unsupported && "border-dashed border-warning/50 bg-warning-subtle/40 hover:border-warning/70",
        disabled && "pointer-events-none opacity-50",
        animateIn && "animate-chip-in",
        className,
      )}
    >
      {editor ? (
        <Popover open={open} onOpenChange={onOpenChange}>
          <PopoverTrigger
            disabled={disabled}
            className="flex min-w-0 items-center gap-1.5 pr-2 pl-3 outline-none hover:bg-accent focus-visible:bg-accent"
          >
            {body}
          </PopoverTrigger>
          <PopoverContent align="start" className="w-72 p-3">
            {editor}
          </PopoverContent>
        </Popover>
      ) : hint ? (
        <Tooltip>
          <TooltipTrigger asChild>
            {/* Focusable so keyboard users get the hint too. */}
            <span tabIndex={0} className="flex min-w-0 items-center gap-1.5 pr-2 pl-3 outline-none focus-visible:bg-accent">
              {body}
            </span>
          </TooltipTrigger>
          <TooltipContent>{hint}</TooltipContent>
        </Tooltip>
      ) : (
        <span className={cn("flex min-w-0 items-center gap-1.5 pl-3", onRemove ? "pr-1" : "pr-3")}>{body}</span>
      )}
      {onRemove && (
        <button
          type="button"
          disabled={disabled}
          onClick={(e) => {
            // Keep keyboard users in the row: focus moves to the neighbouring chip instead of falling to <body>.
            const chip = e.currentTarget.parentElement
            const neighbour = (chip?.nextElementSibling ?? chip?.previousElementSibling)?.querySelector<HTMLElement>("button")
            onRemove()
            requestAnimationFrame(() => neighbour?.isConnected && neighbour.focus())
          }}
          aria-label={`Remove ${label} ${value}`}
          className="group/x flex w-8 shrink-0 items-center justify-center pr-1 text-muted-foreground outline-none max-sm:w-9"
        >
          <span className="flex size-5 items-center justify-center rounded-full transition-colors group-hover/x:bg-accent group-hover/x:text-foreground group-focus-visible/x:bg-accent group-focus-visible/x:ring-2 group-focus-visible/x:ring-ring/50">
            <XIcon className="size-3" />
          </span>
        </button>
      )}
    </span>
  )
})

/** Dashed chip that opens an editor to add a new filter. */
export function AddFilterChip({
  editor,
  open,
  onOpenChange,
  disabled,
}: {
  editor: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
  disabled?: boolean
}) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger
        disabled={disabled}
        className="inline-flex h-8 items-center gap-1 rounded-full border border-dashed border-border-strong px-3 text-sm text-muted-foreground outline-none transition-colors hover:border-foreground/30 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50 data-[state=open]:border-primary data-[state=open]:text-foreground max-sm:h-9"
      >
        <PlusIcon className="size-3.5" />
        Add filter
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-3">
        {editor}
      </PopoverContent>
    </Popover>
  )
}

/**
 * Wrapping row of chips with an accessible group label. `heading` adds the "✦ Understood" line above the
 * chips (what the model read from the brief); `onClear` adds a quiet "Clear all" action beside it.
 */
export function FilterChipList({
  children,
  className,
  listClassName,
  label = "Search filters",
  heading,
  onClear,
}: {
  children: React.ReactNode
  className?: string
  /** Classes for the row of chips itself (e.g. a horizontally scrolling row on mobile). */
  listClassName?: string
  label?: string
  heading?: string
  onClear?: () => void
}) {
  const chips = (
    <div role="group" aria-label={label} className={cn("flex flex-wrap items-center gap-2", !heading && className, listClassName)}>
      {children}
    </div>
  )
  if (!heading) return chips
  return (
    <div className={className}>
      <div className="mb-2.5 flex h-6 items-center justify-between gap-3">
        <p className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <SparklesIcon aria-hidden className="size-3.5 text-primary" />
          {heading}
        </p>
        {onClear && (
          <button
            type="button"
            onClick={onClear}
            className="inline-flex h-6 items-center gap-1 rounded-full px-2 text-xs text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 max-sm:h-9"
          >
            <XIcon aria-hidden className="size-3" />
            Clear all
          </button>
        )}
      </div>
      {chips}
    </div>
  )
}

export function FilterChipsSkeleton({ count = 4 }: { count?: number }) {
  const widths = ["w-28", "w-36", "w-24", "w-32", "w-20"]
  return (
    <div className="flex flex-wrap gap-2" aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} className={cn("h-8 rounded-full", widths[i % widths.length])} />
      ))}
    </div>
  )
}
