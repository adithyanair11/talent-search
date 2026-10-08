import { api } from "@/lib/api-client"
import type { PersonResponse } from "@/lib/schemas/people"

export const fetchPerson = (id: string, signal?: AbortSignal) =>
  api.get<PersonResponse>(`/api/people/${encodeURIComponent(id)}`, signal)
