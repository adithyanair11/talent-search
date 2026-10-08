"use client"

import { useId, useState } from "react"
import { FilterChipOptions } from "@/components/filter-chip-options"
import { Input } from "@/components/ui/input"
import { MAX_YEARS } from "@/lib/limits"
import type { Filters } from "@/lib/schemas/filters"
import { cn } from "@/lib/utils"
import {
  CITY_NAMES,
  COMPANY_NAMES,
  COMPANY_TYPES,
  DEGREES,
  FIELDS_OF_STUDY,
  ROLES,
  SCHOOLS,
  SENIORITIES,
  SKILLS,
  STATES,
} from "@/lib/vocabulary"
import { type ConstraintKey, parseYearsRange, toggleValue, withFilter } from "../filter-model"

/**
 * The popover body that edits one "Understood" chip. Loaded with next/dynamic by search-filters.tsx: it carries
 * cmdk and the vocabulary lists, which nobody needs until a chip is opened.
 */

export type Edit = (next: Filters, edited: ConstraintKey) => void

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const STATE_SET = new Set<string>(STATES)
const LOCATION_OPTIONS = [...CITY_NAMES, ...STATES]
const formatLocation = (v: string) => (STATE_SET.has(v) ? `${v} (state)` : v)

/** Closed-vocabulary list filters edited with the standard checkbox list. */
const LIST_OPTIONS = {
  roles: ROLES,
  seniority: SENIORITIES,
  skills_all: SKILLS,
  skills_any: SKILLS,
  degrees: DEGREES,
  schools: SCHOOLS,
  fields_of_study: FIELDS_OF_STUDY,
} as const

type ListKey = keyof typeof LIST_OPTIONS

function isListKey(key: ConstraintKey): key is ListKey {
  return key in LIST_OPTIONS
}

export function FilterEditor({ filterKey, filters, onEdit }: { filterKey: ConstraintKey; filters: Filters; onEdit: Edit }) {
  if (isListKey(filterKey)) {
    const selected: readonly string[] = filters[filterKey] ?? []
    const editor = (
      <FilterChipOptions
        options={LIST_OPTIONS[filterKey]}
        selected={selected}
        formatOption={filterKey === "seniority" ? capitalize : undefined}
        placeholder="Filter values…"
        onToggle={(v) => {
          const next = toggleValue(selected, v)
          if (next.length) onEdit(withFilter(filters, filterKey, next as Filters[ListKey]), filterKey)
        }}
      />
    )
    return <WithRemoveHint>{editor}</WithRemoveHint>
  }

  switch (filterKey) {
    case "locations": {
      const selected = (filters.locations ?? []).map((l) => ("city" in l ? l.city : l.state))
      return (
        <WithRemoveHint>
          <FilterChipOptions
            options={LOCATION_OPTIONS}
            selected={selected}
            formatOption={formatLocation}
            placeholder="Filter cities and states…"
            onToggle={(v) => {
              const next = toggleValue(selected, v).map((x) =>
                STATE_SET.has(x) ? { state: x as (typeof STATES)[number] } : { city: x as (typeof CITY_NAMES)[number] },
              )
              if (next.length) onEdit(withFilter(filters, "locations", next), "locations")
            }}
          />
        </WithRemoveHint>
      )
    }
    case "open_to_work":
      return (
        <FilterChipOptions
          options={["Yes", "No"]}
          selected={[filters.open_to_work ? "Yes" : "No"]}
          onToggle={(v) => onEdit(withFilter(filters, "open_to_work", v === "Yes"), "open_to_work")}
        />
      )
    case "years_experience":
      return <YearsEditor filters={filters} onEdit={onEdit} />
    case "companies": {
      const c = filters.companies
      if (!c) return null
      return (
        <div className="space-y-3">
          <ScopeToggle
            value={c.scope}
            onChange={(scope) => onEdit(withFilter(filters, "companies", { ...c, scope }), "companies")}
          />
          <FilterChipOptions
            options={COMPANY_NAMES}
            selected={c.names}
            placeholder="Filter companies…"
            onToggle={(v) => {
              const names = toggleValue(c.names, v as (typeof COMPANY_NAMES)[number])
              if (names.length) onEdit(withFilter(filters, "companies", { ...c, names }), "companies")
            }}
          />
        </div>
      )
    }
    case "company_type": {
      const t = filters.company_type
      if (!t) return null
      return (
        <div className="space-y-3">
          <ScopeToggle
            value={t.scope}
            onChange={(scope) => onEdit(withFilter(filters, "company_type", { ...t, scope }), "company_type")}
          />
          <FilterChipOptions
            options={COMPANY_TYPES}
            selected={[t.value]}
            formatOption={capitalize}
            onToggle={(v) =>
              onEdit(
                withFilter(filters, "company_type", { ...t, value: v as (typeof COMPANY_TYPES)[number] }),
                "company_type",
              )
            }
          />
        </div>
      )
    }
    default:
      return null
  }
}

/** Editors keep at least one value (unchecking the last one would close the popover); × removes the filter. */
function WithRemoveHint({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      {children}
      <p className="border-t border-border px-1 pt-2 text-xs text-muted-foreground">
        To drop this filter, use × on the chip.
      </p>
    </div>
  )
}

/** Any job vs current job, for company filters. */
function ScopeToggle({ value, onChange }: { value: "any" | "current"; onChange: (v: "any" | "current") => void }) {
  const options = [
    { value: "any", label: "Any time" },
    { value: "current", label: "Currently" },
  ] as const
  return (
    <div role="radiogroup" aria-label="When" className="grid grid-cols-2 gap-1 rounded-md bg-muted p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => value !== o.value && onChange(o.value)}
          className={cn(
            "h-7 rounded-sm text-sm font-medium text-muted-foreground outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50 max-sm:h-9",
            value === o.value && "bg-background text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** Min / max years. Valid changes apply as you type (the owner debounces the re-run). */
function YearsEditor({ filters, onEdit }: { filters: Filters; onEdit: Edit }) {
  const r = filters.years_experience
  const [min, setMin] = useState(r?.min?.toString() ?? "")
  const [max, setMax] = useState(r?.max?.toString() ?? "")
  const [error, setError] = useState<string | null>(null)
  const minId = useId()
  const maxId = useId()
  const errorId = useId()

  function apply(nextMin: string, nextMax: string) {
    const parsed = parseYearsRange(nextMin, nextMax)
    if ("error" in parsed) return setError(parsed.error)
    if (!parsed.range) return setError("Enter a minimum or a maximum. To drop this filter, use × on the chip.")
    setError(null)
    onEdit(withFilter(filters, "years_experience", parsed.range), "years_experience")
  }

  const field = (id: string, label: string, value: string, set: (v: string) => void, other: () => string, isMin: boolean) => (
    <div className="flex-1 space-y-1.5">
      <label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        {label}
      </label>
      <Input
        id={id}
        type="number"
        inputMode="numeric"
        min={0}
        max={MAX_YEARS}
        placeholder="Any"
        autoFocus={isMin}
        value={value}
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={error ? errorId : undefined}
        className="tabular-nums"
        onChange={(e) => {
          set(e.target.value)
          if (isMin) apply(e.target.value, other())
          else apply(other(), e.target.value)
        }}
      />
    </div>
  )

  return (
    <div className="space-y-2">
      <div className="flex items-end gap-2">
        {field(minId, "Min years", min, setMin, () => max, true)}
        <span aria-hidden className="pb-2 text-muted-foreground">
          –
        </span>
        {field(maxId, "Max years", max, setMax, () => min, false)}
      </div>
      {error && (
        <p id={errorId} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
