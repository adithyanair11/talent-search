"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"

/**
 * supabase-js (~220 KB: auth, realtime, storage, postgrest) is only needed at the moment someone signs in or out,
 * so it is loaded on demand instead of shipping with every page. `preloadAuthClient` warms it off the critical path.
 */
const loadSupabase = () => import("./supabase-browser").then((m) => m.getSupabaseBrowser())
export const preloadAuthClient = () => void loadSupabase().catch(() => undefined)

export type SignInError = "invalid_credentials" | "network" | "unknown"

/** Sign in with email + password. The session cookie is set by the Supabase browser client. */
export function useSignIn() {
  const queryClient = useQueryClient()
  return useMutation<void, SignInError, { email: string; password: string }>({
    mutationFn: async ({ email, password }) => {
      let result
      try {
        result = await (await loadSupabase()).auth.signInWithPassword({ email, password })
      } catch {
        throw "network" satisfies SignInError
      }
      const { error } = result
      if (!error) return
      if (error.code === "invalid_credentials" || error.status === 400) throw "invalid_credentials" satisfies SignInError
      if (error.name === "AuthRetryableFetchError" || error.status === 0) throw "network" satisfies SignInError
      throw "unknown" satisfies SignInError
    },
    // A different recruiter may be signing in on this tab: drop anything cached for the previous one.
    onSuccess: () => queryClient.clear(),
  })
}

/** Sign out this browser only, clear cached data, and return to /login. */
export function useSignOut() {
  const queryClient = useQueryClient()
  const router = useRouter()
  return useMutation({
    mutationFn: async () => {
      const { error } = await (await loadSupabase()).auth.signOut({ scope: "local" })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.clear()
      router.replace("/login")
      router.refresh()
    },
  })
}
