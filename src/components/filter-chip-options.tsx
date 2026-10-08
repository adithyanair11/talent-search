"use client"

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
