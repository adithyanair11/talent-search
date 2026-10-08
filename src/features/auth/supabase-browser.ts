"use client"

import { createBrowserClient } from "@supabase/ssr"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/database.types"

let client: SupabaseClient<Database> | undefined

/** Browser Supabase client, used only for sign-in / sign-out (the session lives in cookies). */
export function getSupabaseBrowser(): SupabaseClient<Database> {
  client ??= createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  )
  return client
}
