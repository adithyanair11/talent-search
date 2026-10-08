import 'server-only'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '@/lib/database.types'

let admin: SupabaseClient<Database> | undefined

/**
 * Service-role Supabase client. Bypasses RLS, so it is only for the Stripe webhook and server-side
 * scripts (seed, test fixtures). Never use it for anything a recruiter request can influence directly.
 */
export function getSupabaseAdmin(): SupabaseClient<Database> {
  if (admin) return admin
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const secretKey = process.env.SUPABASE_SECRET_KEY
  if (!url || !secretKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY must be set')
  }
  admin = createClient<Database>(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
  return admin
}
