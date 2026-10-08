"use client"

import dynamic from "next/dynamic"
import { memo, useCallback, useEffect, useMemo } from "react"
import { FilterChip, FilterChipList } from "@/components/filter-chip"
import { Skeleton } from "@/components/ui/skeleton"
import type { Filters } from "@/lib/schemas/filters"
import { type Chip, chipsFor } from "../filter-model"
import { useSearchUiStore } from "../store"
import type { Edit } from "./filter-editor"

const loadEditor = () => import("./filter-editor")

// The editors (cmdk + the vocabulary lists) only matter once a chip is opened, so they stay out of the page's
// first load; SearchFilters warms the chunk as soon as chips are on screen.
const FilterEditor = dynamic(() => loadEditor().then((m) => m.FilterEditor), {
  ssr: false,
  loading: () => (
    <div className="space-y-2 p-1" aria-hidden>
      <Skeleton className="h-8 w-full rounded-md" />
      <Skeleton className="h-6 w-3/4 rounded-md" />
      <Skeleton className="h-6 w-2/3 rounded-md" />
    </div>
  ),
})

/**
 * "Understood": one chip per filter, each editable in a popover (values from the data vocabulary) and removable
 * with its ×. Every edit is reported through `onEdit`; the owner debounces and re-runs the search.
 * `animateIn` plays the chips' entrance (only when a new brief's chips first appear, never on edits).
 * Pass stable callbacks: each chip is memoised, so opening one editor re-renders only the chips it toggles.
 */
export function SearchFilters({
  filters,
  onEdit,
  onRemove,
  onRemoveUnsupported,
  onClear,
  animateIn = false,
}: {
  filters: Filters
  onEdit: Edit
  onRemove: (chip: Chip) => void
  onRemoveUnsupported: (item: string) => void
  onClear?: () => void
  animateIn?: boolean
}) {
  const chips = useMemo(() => chipsFor(filters), [filters])
  const unsupported = filters.unsupported ?? []

  useEffect(() => {
    void loadEditor()
  }, [])

  if (chips.length === 0 && unsupported.length === 0) return null

  return (
    <FilterChipList
      label="Understood filters"
      heading="Understood"
      onClear={onClear}
      // Mobile: one horizontally scrolling row; the bleed keeps chips flush with the page gutter.
      listClassName="max-sm:-mx-4 max-sm:flex-nowrap max-sm:overflow-x-auto max-sm:px-4 max-sm:pb-1 max-sm:[scrollbar-width:none] max-sm:[&>*]:shrink-0"
    >
      {chips.map((chip, i) => (
        <UnderstoodChip
          key={chip.key}
          chip={chip}
          index={i}
          animateIn={animateIn}
          filters={filters}
          onEdit={onEdit}
          onRemove={onRemove}
        />
      ))}
      {unsupported.map((item, i) => (
        <UnsupportedChip
          key={`unsupported:${item}`}
          item={item}
          index={chips.length + i}
          animateIn={animateIn}
          onRemove={onRemoveUnsupported}
        />
      ))}
    </FilterChipList>
  )
}

const UnderstoodChip = memo(function UnderstoodChip({
  chip,
  index,
  animateIn,
  filters,
  onEdit,
  onRemove,
}: {
  chip: Chip
  index: number
  animateIn: boolean
  filters: Filters
  onEdit: Edit
  onRemove: (chip: Chip) => void
}) {
  // A boolean per chip: opening one editor doesn't re-render the others.
  const open = useSearchUiStore((s) => s.openChip === chip.key)
  const setOpenChip = useSearchUiStore((s) => s.setOpenChip)
  const onOpenChange = useCallback((next: boolean) => setOpenChip(next ? chip.key : null), [setOpenChip, chip.key])
  const remove = useCallback(() => onRemove(chip), [onRemove, chip])
  const editor = useMemo(
    () => <FilterEditor filterKey={chip.key} filters={filters} onEdit={onEdit} />,
    [chip.key, filters, onEdit],
  )
  return (
    <FilterChip
      label={chip.label}
      value={chip.value}
      className="max-w-72"
      animateIn={animateIn}
      index={index}
      open={open}
      onOpenChange={onOpenChange}
      onRemove={remove}
      editor={editor}
    />
  )
})

const UnsupportedChip = memo(function UnsupportedChip({
  item,
  index,
  animateIn,
  onRemove,
}: {
  item: string
  index: number
  animateIn: boolean
  onRemove: (item: string) => void
}) {
  const remove = useCallback(() => onRemove(item), [onRemove, item])
  return (
    <FilterChip
      label="Can't search"
      value={item}
      unsupported
      hint="Not in our candidate data, so it isn't applied"
      className="max-w-72"
      animateIn={animateIn}
      index={index}
      onRemove={remove}
    />
  )
})
