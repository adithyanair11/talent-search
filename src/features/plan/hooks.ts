"use client"

import { useQuery } from "@tanstack/react-query"
import { fetchPlan } from "./api"

export const planKeys = { all: ["plan"] as const }

/** Current plan + remaining free searches. Search invalidates `planKeys.all` after each run. */
export function usePlan() {
  return useQuery({ queryKey: planKeys.all, queryFn: ({ signal }) => fetchPlan(signal) })
}
