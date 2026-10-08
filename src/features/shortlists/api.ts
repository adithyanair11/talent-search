import { api } from "@/lib/api-client"
import type {
  AddPersonResponse,
  CreateShortlistResponse,
  RenameShortlistResponse,
  ShortlistDetail,
  ShortlistsResponse,
} from "@/lib/schemas/shortlists"

const list = (id: string) => `/api/shortlists/${encodeURIComponent(id)}`
const member = (id: string, personId: string) => `${list(id)}/people/${encodeURIComponent(personId)}`

export const fetchShortlists = (signal?: AbortSignal) => api.get<ShortlistsResponse>("/api/shortlists", signal)
export const fetchShortlist = (id: string, signal?: AbortSignal) => api.get<ShortlistDetail>(list(id), signal)
export const createShortlist = (name: string) => api.post<CreateShortlistResponse>("/api/shortlists", { name })
export const renameShortlist = (id: string, name: string) => api.patch<RenameShortlistResponse>(list(id), { name })
export const deleteShortlist = (id: string) => api.delete<null>(list(id))
export const addToShortlist = (id: string, personId: string) => api.post<AddPersonResponse>(member(id, personId))
export const removeFromShortlist = (id: string, personId: string) => api.delete<null>(member(id, personId))
