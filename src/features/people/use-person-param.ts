"use client"

import { useSearchParams } from "next/navigation"
import { useCallback, useRef } from "react"

/** `?p=<candidate id>` opens the candidate sheet, so a profile is linkable and Back closes it. */
export const PERSON_PARAM = "p"

/** Longer than any real id; a garbage param is still shown (as "not available"), but never sent unbounded. */
const MAX_PARAM_LENGTH = 64

function withPerson(id: string | null): string {
  const url = new URL(window.location.href)
  if (id === null) url.searchParams.delete(PERSON_PARAM)
  else url.searchParams.set(PERSON_PARAM, id)
  return url.pathname + url.search + url.hash
}

/**
 * The open candidate lives in the URL. Opening pushes a history entry (Back closes the sheet); stepping to
 * the previous/next result replaces it (Back still closes, rather than walking through every profile).
 * Closing pops the entry we pushed, or strips the param when the page was opened from a shared link.
 * Uses the native History API, which Next keeps in sync with `useSearchParams` without a server round trip.
 * All callbacks are stable, so memoized rows don't re-render when the sheet opens.
 */
export function usePersonParam() {
  const raw = useSearchParams().get(PERSON_PARAM)
  const personId = raw ? raw.slice(0, MAX_PARAM_LENGTH) : null
  const pushed = useRef(false)

  const open = useCallback((id: string) => {
    const already = new URL(window.location.href).searchParams.has(PERSON_PARAM)
    if (already) {
      window.history.replaceState(null, "", withPerson(id))
    } else {
      pushed.current = true
      window.history.pushState(null, "", withPerson(id))
    }
  }, [])

  const step = useCallback((id: string) => window.history.replaceState(null, "", withPerson(id)), [])

  const close = useCallback(() => {
    if (pushed.current) {
      pushed.current = false
      window.history.back()
    } else {
      window.history.replaceState(null, "", withPerson(null))
    }
  }, [])

  return { personId, open, step, close }
}
