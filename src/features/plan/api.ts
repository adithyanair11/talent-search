import { api } from "@/lib/api-client"
import type { PlanResponse } from "@/lib/plan"

export const fetchPlan = (signal?: AbortSignal) => api.get<PlanResponse>("/api/plan", signal)
