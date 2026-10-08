/**
 * Local demos only: sets `searches_used` back to 0 for every company, so each gets its free search again.
 * Leaves searches, subscriptions and stripe_events alone. Refuses to run against a non-local Supabase.
 * Not called by `make setup` or `make dev`; run it with `make reset-quota`.
 */
import './lib/env'

import { getSupabaseAdmin } from '../src/server/supabase-admin'

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]'])

async function main(): Promise<void> {
  const host = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://invalid').hostname
  if (!LOCAL_HOSTS.has(host)) {
    console.error(`✖ reset-quota only runs against local Supabase (got host "${host}").`)
    process.exit(1)
  }

  const { data, error } = await getSupabaseAdmin()
    .from('companies')
    .update({ searches_used: 0 })
    .gte('searches_used', 0)
    .select('slug')
  if (error) {
    console.error(`✖ reset-quota failed: ${error.message}`)
    process.exit(1)
  }
  console.log(`✔ Free search quota reset for: ${data.map((c) => c.slug).sort().join(', ')}`)
}

void main()
