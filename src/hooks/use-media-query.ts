"use client"

import { useCallback, useSyncExternalStore } from "react"

/** Breakpoint used to switch sheet ↔ drawer, sidebar ↔ tab bar. Mirrors Tailwind `md`. */
export const DESKTOP_QUERY = "(min-width: 768px)"

/**
 * Subscribe to a media query. Returns `false` on the server and during hydration, so layout that
 * must be correct on first paint should use CSS breakpoints; use this only to choose *behaviour*
 * (e.g. Sheet vs Drawer) for content that opens after interaction.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const mql = window.matchMedia(query)
      mql.addEventListener("change", onChange)
      return () => mql.removeEventListener("change", onChange)
    },
    [query],
  )
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  )
}

export function useIsDesktop(): boolean {
  return useMediaQuery(DESKTOP_QUERY)
}
