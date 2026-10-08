"use client"

import { Composer, type ComposerProps } from "@/components/composer"

export { BRIEF_MAX_LENGTH } from "@/components/composer"

type SearchBarProps = Omit<ComposerProps, "variant" | "title" | "description" | "suggestions" | "onSuggestion">

/**
 * Backwards-compatible name for the docked `Composer` (the bar above results). New code should use
 * `Composer` directly and pick a variant.
 */
export function SearchBar(props: SearchBarProps) {
  return <Composer variant="docked" {...props} />
}
