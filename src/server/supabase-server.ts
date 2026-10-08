import 'server-only'

import { createServerClient } from '@supabase/ssr'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

import type { Database } from '@/lib/database.types'

export type Supabase = SupabaseClient<Database>

export function supabaseConfig(): { url: string; publishableKey: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  if (!url || !publishableKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY must be set')
  }
  return { url, publishableKey }
}

/**
 * RLS client for the signed-in browser session (auth cookies). Create one per request.
 * Server Components can't write cookies, so a token refresh there is dropped; `proxy.ts` refreshes the
 * session before every page and API request, so the cookies it sees are already current.
 */
export async function createSupabaseServerClient(): Promise<Supabase> {
  const { url, publishableKey } = supabaseConfig()
  const cookieStore = await cookies()
  return createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        try {
          for (const { name, value, options } of toSet) cookieStore.set(name, value, options)
        } catch {
          // Called from a Server Component: read-only cookies. proxy.ts handles the refresh.
        }
      },
    },
  })
}

/** RLS client acting as the holder of `accessToken` (an `Authorization: Bearer` API caller). */
export function createSupabaseTokenClient(accessToken: string): Supabase {
  const { url, publishableKey } = supabaseConfig()
  return createClient<Database>(url, publishableKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}
