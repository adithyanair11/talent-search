"use client"

import { useEffect, useRef } from "react"
import { CheckboxIndicator } from "@/components/checkbox-indicator"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"

// Separate from filter-chip.tsx so cmdk only loads when an editor opens (feature code imports it with next/dynamic).
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
  const ref = useRef<HTMLDivElement>(null)
  const first = selected[0]
  const firstText = first === undefined ? undefined : formatOption ? formatOption(first) : first

  // The editor mounts after its popover opened (it is lazy-loaded), so the popover's own auto-focus has already
  // landed on its frame. Move focus into the list so arrow keys, Enter and typing work straight away. On touch
  // screens the filter input isn't focused: that would open the on-screen keyboard over the list.
  useEffect(() => {
    const root = ref.current
    if (!root || root.contains(document.activeElement)) return
    const input = window.matchMedia("(pointer: fine)").matches ? root.querySelector<HTMLElement>("[cmdk-input]") : null
    ;(input ?? root).focus()
  }, [])

  return (
    <Command
      ref={ref}
      tabIndex={-1}
      defaultValue={firstText}
      className="-m-1 w-auto bg-transparent outline-none"
    >
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
