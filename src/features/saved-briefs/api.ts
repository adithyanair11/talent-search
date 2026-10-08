import { api } from "@/lib/api-client"
import type { Filters } from "@/lib/schemas/filters"
import type { CreateSavedBriefResponse, SavedBriefsResponse } from "@/lib/schemas/saved-briefs"

export const fetchSavedBriefs = (signal?: AbortSignal) => api.get<SavedBriefsResponse>("/api/saved-briefs", signal)
export const createSavedBrief = (brief: string, filters: Filters) =>
  api.post<CreateSavedBriefResponse>("/api/saved-briefs", { brief, filters })
export const deleteSavedBrief = (id: string) => api.delete<null>(`/api/saved-briefs/${encodeURIComponent(id)}`)
