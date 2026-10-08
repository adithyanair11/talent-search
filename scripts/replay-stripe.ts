/**
 * Replays data/stripe-events.json against the running app's webhook and checks the resulting plans.
 *
 *   1. Resets the billing tables (subscriptions, stripe_events) with the admin client.
 *   2. POSTs every sample event in file order with its exact body. The file's own Stripe-Signature header is
 *      sent when it verifies with STRIPE_WEBHOOK_SECRET (the grader's secret); otherwise each exact body is
 *      re-signed with the local secret at the same `t` (docs/decisions.md "Billing").
 *   3. Prints both companies' plan (via GET /api/plan as each recruiter) after every event and asserts the
 *      per-step outcome from docs/data-notes.md §5 and the file's `expected_plans_after`.
 *   4. Extra scenarios with events generated and signed here: bad signature, replay, reversed pair,
 *      cancel-then-resubscribe, out-of-order cancel, tie on `created`.
 *   5. Resets again and replays the sample file, so the database ends in the documented sample state.
 *
 * Needs `make dev` running (or API_BASE_URL). Do not run concurrently with eval / test:quota (they add fixture
 * subscriptions that the reset removes). Exits 1 on any failed assertion.
 */
import { requireEnv } from './lib/env'

import { readFileSync } from 'node:fs'
import path from 'node:path'

import { signStripePayload, verifyStripeSignature } from '../src/server/billing/verify-signature'
import { getSupabaseAdmin } from '../src/server/supabase-admin'
import { api, API_BASE, RECRUITER, requireServer, signIn } from './lib/api'

type Slug = keyof typeof RECRUITER
type Plan = 'free' | 'paid'
type Plans = Record<Slug, Plan>
type SampleFile = {
  events: { description: string; headers: { 'Stripe-Signature': string }; payload: string }[]
  expected_plans_after?: Plans
}

const SECRET = requireEnv('STRIPE_WEBHOOK_SECRET')
const SAMPLE = JSON.parse(readFileSync(path.resolve(process.cwd(), 'data/stripe-events.json'), 'utf8')) as SampleFile
const RUN = Date.now()
const admin = getSupabaseAdmin()
const tokens = {} as Record<Slug, string>
const failures: string[] = []
let seq = 0

function check(ok: boolean, what: string): void {
  if (!ok) {
    console.log(`    ✖ ${what}`)
    failures.push(what)
  }
}

async function resetBilling(): Promise<void> {
  const subs = await admin.from('subscriptions').delete().neq('stripe_subscription_id', '')
  const events = await admin.from('stripe_events').delete().neq('event_id', '')
  if (subs.error || events.error) throw new Error(`reset failed: ${(subs.error ?? events.error)!.message}`)
}

async function post(body: string, signature: string): Promise<{ status: number; result?: string }> {
  const res = await fetch(`${API_BASE}/api/billing/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Stripe-Signature': signature },
    body,
  })
  const json = (await res.json().catch(() => null)) as { result?: string } | null
  return { status: res.status, result: json?.result }
}

/** A Stripe-Signature header for `body` with the configured secret (same HMAC as the webhook verifies). */
const sign = (body: string, t: number | string = Math.floor(Date.now() / 1000)) =>
  `t=${t},v1=${signStripePayload(body, SECRET, t)}`

async function plans(): Promise<Plans> {
  const out = {} as Plans
  for (const slug of Object.keys(RECRUITER) as Slug[]) {
    const res = await api<{ plan: Plan }>(tokens[slug], 'GET', '/api/plan')
    if (res.status !== 200) throw new Error(`/api/plan for ${slug} returned ${res.status}`)
    out[slug] = res.body.plan
  }
  return out
}

const fmt = (p: Plans) => `acme: ${p.acme.padEnd(4)} · globex: ${p.globex}`

/** A subscription event shaped like the sample file's, with a unique id unless one is given. */
function subEvent(slug: Slug, type: 'created' | 'updated' | 'deleted', sub: string, status: string, created: number, id?: string): string {
  return JSON.stringify({
    id: id ?? `evt_replay_${RUN}_${++seq}`,
    object: 'event',
    api_version: '2025-09-30',
    created,
    livemode: false,
    type: `customer.subscription.${type}`,
    data: { object: { id: sub, object: 'subscription', customer: `cus_${slug}`, status, metadata: { company: slug } } },
  })
}

type Expect = { status: number; result?: string; plans: Plans }

async function step(label: string, body: string, signature: string, want: Expect): Promise<void> {
  const res = await post(body, signature)
  const now = await plans()
  console.log(`  ${label.padEnd(50)} → ${res.status} ${(res.result ?? '-').padEnd(9)} ${fmt(now)}`)
  check(res.status === want.status, `${label}: expected HTTP ${want.status}, got ${res.status}`)
  if (want.result) check(res.result === want.result, `${label}: expected ${want.result}, got ${res.result}`)
  check(now.acme === want.plans.acme && now.globex === want.plans.globex, `${label}: expected ${fmt(want.plans)}`)
}

/** Signs and sends a generated event. */
const sendSigned = (label: string, body: string, want: Expect) => step(label, body, sign(body), want)

/** The sample file, in order; per-step outcomes from docs/data-notes.md §5. */
const SAMPLE_EXPECT: Expect[] = [
  { status: 200, result: 'applied', plans: { acme: 'paid', globex: 'free' } },
  { status: 200, result: 'duplicate', plans: { acme: 'paid', globex: 'free' } },
  { status: 200, result: 'applied', plans: { acme: 'paid', globex: 'paid' } },
  { status: 200, result: 'stale', plans: { acme: 'paid', globex: 'paid' } },
  { status: 200, result: 'applied', plans: { acme: 'free', globex: 'paid' } },
]

async function replaySample(verbose: boolean): Promise<void> {
  const fileSigned = SAMPLE.events.every((e) => verifyStripeSignature(e.payload, e.headers['Stripe-Signature'], SECRET))
  if (verbose) {
    console.log(
      fileSigned
        ? '  Sending each event with its exact Stripe-Signature header (it verifies with STRIPE_WEBHOOK_SECRET).'
        : '  The file was signed with another secret: re-signing each exact payload with the local secret (same t).',
    )
  }
  for (const [i, e] of SAMPLE.events.entries()) {
    const header = e.headers['Stripe-Signature']
    const signature = fileSigned ? header : sign(e.payload, /(?:^|,)t=(\d+)/.exec(header)?.[1] ?? '0')
    if (verbose) {
      await step(`#${i + 1} ${e.description}`, e.payload, signature, SAMPLE_EXPECT[i] ?? { status: 200, plans: await plans() })
    } else {
      const res = await post(e.payload, signature)
      check(res.status === 200, `restore #${i + 1}: expected HTTP 200, got ${res.status}`)
    }
  }
}

async function main(): Promise<void> {
  await requireServer()
  for (const slug of Object.keys(RECRUITER) as Slug[]) tokens[slug] = (await signIn(RECRUITER[slug])).token
  const want: Plans = SAMPLE.expected_plans_after ?? { acme: 'free', globex: 'paid' }

  console.log('\n▶ Sample events (data/stripe-events.json), billing tables reset')
  await resetBilling()
  console.log(`  ${'start'.padEnd(50)}                ${fmt(await plans())}`)
  await replaySample(true)
  const final = await plans()
  check(final.acme === want.acme && final.globex === want.globex, `final state should be ${fmt(want)}`)
  console.log(`  final: ${fmt(final)} (expected_plans_after: ${fmt(want)})`)

  console.log('\n▶ Signature and replay')
  const third = SAMPLE.events[2]
  await step('tampered body, original header', third.payload.replace('"active"', '"trialing"'), third.headers['Stripe-Signature'], {
    status: 400,
    plans: final,
  })
  await step('wrong secret', third.payload, `t=1,v1=${signStripePayload(third.payload, 'whsec_wrong', 1)}`, {
    status: 400,
    plans: final,
  })
  await step('missing header', third.payload, '', { status: 400, plans: final })
  await sendSigned('replay of delivery #3 (new signature)', third.payload, { status: 200, result: 'duplicate', plans: final })

  // Generated scenarios: fresh subscription ids and `created` after the sample, so they compose with its state.
  const base = 1_800_000_000
  console.log('\n▶ Deliberately reversed pair (globex)')
  await sendSigned('cancel sub_sample_globex', subEvent('globex', 'deleted', 'sub_sample_globex', 'canceled', base + 10), {
    status: 200,
    result: 'applied',
    plans: { acme: 'free', globex: 'free' },
  })
  const gSub = `sub_replay_${RUN}_globex`
  await sendSigned('newer: active (T+40) arrives first', subEvent('globex', 'updated', gSub, 'active', base + 40), {
    status: 200,
    result: 'applied',
    plans: { acme: 'free', globex: 'paid' },
  })
  await sendSigned('older: incomplete (T+30) → ignored', subEvent('globex', 'created', gSub, 'incomplete', base + 30), {
    status: 200,
    result: 'stale',
    plans: { acme: 'free', globex: 'paid' },
  })

  console.log('\n▶ Cancellation then resubscribe (acme)')
  const aSub2 = `sub_replay_${RUN}_acme_2`
  await sendSigned('new subscription active', subEvent('acme', 'created', aSub2, 'active', base + 50), {
    status: 200,
    result: 'applied',
    plans: { acme: 'paid', globex: 'paid' },
  })
  await sendSigned('newer event on the canceled sub → stays canceled', subEvent('acme', 'updated', 'sub_sample_acme', 'active', base + 60), {
    status: 200,
    result: 'stale',
    plans: { acme: 'paid', globex: 'paid' },
  })
  await sendSigned('cancel the new subscription', subEvent('acme', 'deleted', aSub2, 'active', base + 70), {
    status: 200,
    result: 'applied',
    plans: { acme: 'free', globex: 'paid' },
  })

  console.log('\n▶ Out-of-order cancel (acme)')
  const aSub3 = `sub_replay_${RUN}_acme_3`
  await sendSigned('created active (T+80)', subEvent('acme', 'created', aSub3, 'active', base + 80), {
    status: 200,
    result: 'applied',
    plans: { acme: 'paid', globex: 'paid' },
  })
  await sendSigned('deleted (T+100) arrives before the update', subEvent('acme', 'deleted', aSub3, 'canceled', base + 100), {
    status: 200,
    result: 'applied',
    plans: { acme: 'free', globex: 'paid' },
  })
  await sendSigned('late updated active (T+90) → ignored', subEvent('acme', 'updated', aSub3, 'active', base + 90), {
    status: 200,
    result: 'stale',
    plans: { acme: 'free', globex: 'paid' },
  })

  console.log('\n▶ Tie on created (acme)')
  const aSub4 = `sub_replay_${RUN}_acme_4`
  await sendSigned('created active (T+110)', subEvent('acme', 'created', aSub4, 'active', base + 110), {
    status: 200,
    result: 'applied',
    plans: { acme: 'paid', globex: 'paid' },
  })
  await sendSigned('updated past_due (T+120, larger id)', subEvent('acme', 'updated', aSub4, 'past_due', base + 120, `evt_replay_${RUN}_tie_9`), {
    status: 200,
    result: 'applied',
    plans: { acme: 'free', globex: 'paid' },
  })
  await sendSigned('updated active (T+120, smaller id) → ignored', subEvent('acme', 'updated', aSub4, 'active', base + 120, `evt_replay_${RUN}_tie_5`), {
    status: 200,
    result: 'stale',
    plans: { acme: 'free', globex: 'paid' },
  })
  await sendSigned('deleted (T+120, smallest id) → canceled wins', subEvent('acme', 'deleted', aSub4, 'canceled', base + 120, `evt_replay_${RUN}_tie_0`), {
    status: 200,
    result: 'applied',
    plans: { acme: 'free', globex: 'paid' },
  })

  console.log('\n▶ Restoring the sample end state (reset + replay the file)')
  await resetBilling()
  await replaySample(false)
  const restored = await plans()
  check(restored.acme === want.acme && restored.globex === want.globex, `restored state should be ${fmt(want)}`)
  console.log(`  ${fmt(restored)}`)

  if (failures.length > 0) {
    console.error(`\n✖ ${failures.length} check(s) failed:\n${failures.map((f) => `  - ${f}`).join('\n')}`)
    process.exit(1)
  }
  console.log('\n✔ replay:stripe passed')
}

main().catch((error: unknown) => {
  console.error('✖ replay:stripe crashed:', error instanceof Error ? error.message : error)
  process.exit(1)
})
