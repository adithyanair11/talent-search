"use client"

import { AlertTriangleIcon, PlusIcon, XIcon } from "lucide-react"
import { memo } from "react"
import { CheckboxIndicator } from "@/components/checkbox-indicator"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
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
  className,
}: FilterChipProps) {
  const body = (
    <>
      {unsupported && <AlertTriangleIcon aria-hidden className="size-3.5 text-warning" />}
      <span className="text-muted-foreground">{label}</span>
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
      className={cn(
        "group/chip inline-flex h-8 max-w-full items-stretch overflow-hidden rounded-md border border-border bg-background text-sm transition-colors max-sm:h-9",
        "has-[[data-state=open]]:border-primary has-[[data-state=open]]:ring-2 has-[[data-state=open]]:ring-primary/15",
        unsupported && "border-dashed border-warning/50 bg-warning-subtle/40",
        disabled && "pointer-events-none opacity-50",
        className,
      )}
    >
      {editor ? (
        <Popover open={open} onOpenChange={onOpenChange}>
          <PopoverTrigger
            disabled={disabled}
            className="flex min-w-0 items-center gap-1.5 pr-2 pl-2.5 outline-none hover:bg-accent focus-visible:bg-accent"
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
            <span tabIndex={0} className="flex min-w-0 items-center gap-1.5 pr-2 pl-2.5 outline-none focus-visible:bg-accent">
              {body}
            </span>
          </TooltipTrigger>
          <TooltipContent>{hint}</TooltipContent>
        </Tooltip>
      ) : (
        <span className="flex min-w-0 items-center gap-1.5 pr-2 pl-2.5">{body}</span>
      )}
      {onRemove && (
        <button
          type="button"
          disabled={disabled}
          onClick={onRemove}
          aria-label={`Remove ${label} ${value}`}
          className="flex w-7 shrink-0 items-center justify-center border-l border-border text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:bg-accent max-sm:w-9"
        >
          <XIcon className="size-3.5" />
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
        className="inline-flex h-8 items-center gap-1 rounded-md border border-dashed border-border-strong px-2.5 text-sm text-muted-foreground outline-none transition-colors hover:border-foreground/30 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50 data-[state=open]:border-primary data-[state=open]:text-foreground max-sm:h-9"
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

/** Wrapping row of chips with an accessible group label. */
export function FilterChipList({
  children,
  className,
  label = "Search filters",
}: {
  children: React.ReactNode
  className?: string
  label?: string
}) {
  return (
    <div role="group" aria-label={label} className={cn("flex flex-wrap items-center gap-2", className)}>
      {children}
    </div>
  )
}

export function FilterChipsSkeleton({ count = 4 }: { count?: number }) {
  const widths = ["w-28", "w-36", "w-24", "w-32", "w-20"]
  return (
    <div className="flex flex-wrap gap-2" aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} className={cn("h-8 rounded-md", widths[i % widths.length])} />
      ))}
    </div>
  )
}

/**
 * Standard chip editor for closed vocabularies (location, seniority, skills…): a filterable list
 * with checkmarks. Values must come from the real data vocabulary.
 */
export function FilterChipOptions({
  options,
  selected,
  onToggle,
  formatOption,
  placeholder = "Filter…",
  emptyText = "No matching values",
}: {
  options: readonly string[]
  selected: readonly string[]
  onToggle: (value: string) => void
  /** Display text for an option when it differs from the value (e.g. "senior" → "Senior"). */
  formatOption?: (value: string) => string
  placeholder?: string
  emptyText?: string
}) {
  return (
    <Command className="-m-1 w-auto bg-transparent">
      {options.length > 8 && <CommandInput placeholder={placeholder} />}
      <CommandList className="max-h-64">
        <CommandEmpty>{emptyText}</CommandEmpty>
        <CommandGroup>
          {options.map((o) => {
            const on = selected.includes(o)
            const text = formatOption ? formatOption(o) : o
            return (
              <CommandItem key={o} value={text} onSelect={() => onToggle(o)} className="gap-2">
                <CheckboxIndicator checked={on} />
                {text}
              </CommandItem>
            )
          })}
        </CommandGroup>
      </CommandList>
    </Command>
  )
}
