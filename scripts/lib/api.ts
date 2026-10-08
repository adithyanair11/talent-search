/**
 * Helpers for scripts that drive the running app over HTTP (eval, bench, test-quota): sign in as a seeded
 * recruiter, call the API with a Bearer token, and put a company into a known plan state for the run.
 *
 * `withCompanyState` uses the admin client only for fixtures (as probe-security does) and always restores:
 * the company's `searches_used`, its subscriptions, and deletes the searches created during the run.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '../../src/lib/database.types'
import { getSupabaseAdmin } from '../../src/server/supabase-admin'
import { requireEnv } from './env'

export type Client = SupabaseClient<Database>

export const PASSWORD = 'rotto-assessment'
export const RECRUITER = { acme: 'recruiter@acme.test', globex: 'recruiter@globex.test' } as const

export const API_BASE = process.env.API_BASE_URL ?? 'http://localhost:3000'

export function newClient(): Client {
  return createClient<Database>(
    requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requireEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'),
    { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } },
  )
}

export async function signIn(email: string): Promise<{ client: Client; token: string; userId: string }> {
  const client = newClient()
  const { data, error } = await client.auth.signInWithPassword({ email, password: PASSWORD })
  if (error || !data.session) throw new Error(`sign-in failed for ${email}: ${error?.message}`)
  return { client, token: data.session.access_token, userId: data.user.id }
}

/** Exits with a clear message when the app isn't running. */
export async function requireServer(): Promise<void> {
  const ok = await fetch(`${API_BASE}/api/plan`, { signal: AbortSignal.timeout(30_000) })
    .then((r) => r.headers.get('content-type')?.includes('application/json') ?? false)
    .catch(() => false)
  if (!ok) {
    console.error(`✖ The app is not reachable at ${API_BASE}. Start it with \`make dev\` (or set API_BASE_URL).`)
    process.exit(1)
  }
}

export interface ApiResult<T = unknown> {
  status: number
  body: T
  ms: number
}

export async function api<T = unknown>(
  token: string,
  method: 'GET' | 'POST',
  path: string,
  body?: unknown,
): Promise<ApiResult<T>> {
  // POST /api/search is rate limited per recruiter (docs/decisions.md "Security pass"). Scripts that fire many
  // searches wait out a 429 instead of failing; `ms` times only the attempt that answered.
  for (let attempt = 1; ; attempt++) {
    const started = performance.now()
    const res = await fetch(API_BASE + path, {
      method,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    const ms = Math.round(performance.now() - started)
    if (res.status === 429 && attempt < 4) {
      await res.body?.cancel()
      const waitSeconds = Number(res.headers.get('retry-after')) || 1
      await new Promise((resolve) => setTimeout(resolve, waitSeconds * 1000))
      continue
    }
    const json = (await res.json().catch(() => null)) as T
    return { status: res.status, body: json, ms }
  }
}

/**
 * Run `fn` with the company forced to a plan: `paid` adds a fixture `active` subscription; `free` temporarily
 * removes its active/trialing subscriptions and sets `searches_used = 0`. Everything is restored afterwards.
 */
export async function withCompanyState<T>(
  slug: keyof typeof RECRUITER,
  state: 'paid' | 'free',
  tag: string,
  fn: (company: { id: string }) => Promise<T>,
): Promise<T> {
  const admin = getSupabaseAdmin()
  const { data: company, error } = await admin.from('companies').select('id, searches_used').eq('slug', slug).single()
  if (error || !company) throw new Error(`company ${slug}: ${error?.message}`)
  const startedAt = new Date().toISOString()
  const fixtureSub = `sub_${tag}`
  const { data: removed } = await admin
    .from('subscriptions')
    .select('*')
    .eq('company_id', company.id)
    .in('status', ['active', 'trialing'])

  try {
    if (state === 'paid') {
      const { error: subError } = await admin.from('subscriptions').insert({
        stripe_subscription_id: fixtureSub,
        company_id: company.id,
        status: 'active',
        last_event_created: 0,
        last_event_id: `evt_${tag}`,
      })
      if (subError) throw new Error(`fixture subscription: ${subError.message}`)
    } else {
      if (removed?.length) {
        await admin.from('subscriptions').delete().in('stripe_subscription_id', removed.map((s) => s.stripe_subscription_id))
      }
      await admin.from('companies').update({ searches_used: 0 }).eq('id', company.id)
    }
    return await fn(company)
  } finally {
    await admin.from('subscriptions').delete().eq('stripe_subscription_id', fixtureSub)
    if (state === 'free' && removed?.length) await admin.from('subscriptions').upsert(removed)
    await admin.from('searches').delete().eq('company_id', company.id).gte('created_at', startedAt)
    await admin.from('companies').update({ searches_used: company.searches_used }).eq('id', company.id)
  }
}
