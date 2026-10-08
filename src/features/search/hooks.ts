"use client"

import { type InfiniteData, useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { planKeys } from "@/features/plan/hooks"
import type { SearchPageResponse, SearchRequest } from "@/lib/schemas/search"
import { fetchSearchPage, runSearch } from "./api"

export const searchKeys = {
  all: ["search"] as const,
  pages: (searchId: string) => ["search", searchId, "pages"] as const,
}

type Pages = InfiniteData<SearchPageResponse, number>

/**
 * Pages of a stored search snapshot (GET /api/search/{id}?page=N). A snapshot never changes, so pages
 * never go stale and paging never re-runs the search.
 */
export function useSearchPages(searchId: string | null) {
  return useInfiniteQuery({
    queryKey: searchKeys.pages(searchId ?? ""),
    queryFn: ({ pageParam, signal }) => fetchSearchPage(searchId!, pageParam, signal),
    initialPageParam: 1,
    getNextPageParam: (last, all) => {
      const loaded = all.reduce((n, p) => n + p.results.length, 0)
      return last.results.length > 0 && loaded < last.total ? last.page + 1 : undefined
    },
    enabled: searchId !== null,
    staleTime: Infinity,
  })
}

/**
 * POST /api/search. On success, page 1 from the response seeds the snapshot cache so navigating to
 * `?s=<id>` renders immediately, and the plan badge refreshes (a search may have used the free quota).
 */
export function useRunSearch() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: SearchRequest) => runSearch(input),
    onSuccess: (res, input) => {
      queryClient.setQueryData<Pages>(searchKeys.pages(res.search_id), {
        pages: [
          { search_id: res.search_id, brief: input.brief, filters: res.filters, total: res.total, page: 1, results: res.results },
        ],
        pageParams: [1],
      })
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: planKeys.all }),
  })
}
