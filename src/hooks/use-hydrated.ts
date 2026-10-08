"use client"

import type { UseQueryResult } from "@tanstack/react-query"
import { useSyncExternalStore } from "react"

const noop = () => () => {}

/**
 * `false` on the server and while this component hydrates, `true` after (and immediately for anything mounted
 * later on the client). Use it to keep the hydration render identical to the server HTML.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(noop, () => true, () => false)
}

/**
 * Report a query as pending until the calling component has hydrated.
 *
 * Why: with partial prerendering the app shell hydrates first and its components (plan badge, saved-searches
 * sidebar) start fetching. A page's Suspense boundary streams in and hydrates later. If one of those shared
 * queries has already resolved by then, an in-page reader (the search quota line, /saved) would render data
 * where the server rendered a skeleton, and React throws hydration error #418. Showing "pending" for that one
 * render keeps both sides equal; the data renders right after. See docs/decisions.md ("Hydration").
 */
export function usePendingUntilHydrated<TData, TError>(
  query: UseQueryResult<TData, TError>,
): UseQueryResult<TData, TError> {
  const hydrated = useHydrated()
  if (hydrated) return query
  return {
    ...query,
    data: undefined,
    error: null,
    status: "pending",
    isPending: true,
    isLoading: true,
    isSuccess: false,
    isError: false,
    isLoadingError: false,
    isRefetchError: false,
    isPlaceholderData: false,
  } as UseQueryResult<TData, TError>
}
