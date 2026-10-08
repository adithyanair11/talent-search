"use client"

import { useQuery } from "@tanstack/react-query"
import { usePendingUntilHydrated } from "@/hooks/use-hydrated"
import { fetchPlan } from "./api"

export const planKeys = { all: ["plan"] as const }

/**
 * Current plan + remaining free searches. Search invalidates `planKeys.all` after each run.
 * Read by the shell and by pages, so it stays pending while the caller hydrates (see `usePendingUntilHydrated`).
 */
export function usePlan() {
  return usePendingUntilHydrated(useQuery({ queryKey: planKeys.all, queryFn: ({ signal }) => fetchPlan(signal) }))
}
