"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { getSupabaseBrowser } from "./supabase-browser"

export type SignInError = "invalid_credentials" | "network" | "unknown"

/** Sign in with email + password. The session cookie is set by the Supabase browser client. */
export function useSignIn() {
  const queryClient = useQueryClient()
  return useMutation<void, SignInError, { email: string; password: string }>({
    mutationFn: async ({ email, password }) => {
      let result
      try {
        result = await getSupabaseBrowser().auth.signInWithPassword({ email, password })
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
      const { error } = await getSupabaseBrowser().auth.signOut({ scope: "local" })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.clear()
      router.replace("/login")
      router.refresh()
    },
  })
}
