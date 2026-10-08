import { api } from "@/lib/api-client"
import type { SearchPageResponse, SearchRequest, SearchResponse } from "@/lib/schemas/search"

export const runSearch = (input: SearchRequest) => api.post<SearchResponse>("/api/search", input)

export const fetchSearchPage = (searchId: string, page: number, signal?: AbortSignal) =>
  api.get<SearchPageResponse>(`/api/search/${encodeURIComponent(searchId)}?page=${page}`, signal)
