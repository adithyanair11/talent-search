import 'server-only'

import { createHmac, timingSafeEqual } from 'node:crypto'

const SIGNATURE_HEX = /^[0-9a-f]{64}$/
const TIMESTAMP = /^[0-9]{1,15}$/

/** `t` and every `v1` from a `Stripe-Signature` header, or null when the header is malformed. Other schemes are skipped. */
export function parseStripeSignature(header: string | null | undefined): { t: string; v1: string[] } | null {
  if (!header) return null
  let t: string | undefined
  const v1: string[] = []
  for (const part of header.split(',')) {
    const eq = part.indexOf('=')
    if (eq <= 0) return null
    const key = part.slice(0, eq).trim()
    const value = part.slice(eq + 1).trim()
    if (key === 't') {
      if (t !== undefined || !TIMESTAMP.test(value)) return null
      t = value
    } else if (key === 'v1') {
      if (!SIGNATURE_HEX.test(value)) return null
      v1.push(value)
    }
  }
  if (t === undefined || v1.length === 0) return null
  return { t, v1 }
}

/** Hex HMAC-SHA256 of `${t}.${rawBody}`, Stripe's v1 scheme. */
export function signStripePayload(rawBody: string, secret: string, t: string | number): string {
  return createHmac('sha256', secret).update(`${t}.${rawBody}`, 'utf8').digest('hex')
}

/**
 * True iff some `v1` in the header is the HMAC of `${t}.${rawBody}` under `secret` (constant-time compare).
 * No timestamp tolerance: the sample events are historic (docs/decisions.md "Billing").
 */
export function verifyStripeSignature(rawBody: string, header: string | null | undefined, secret: string): boolean {
  if (!secret) return false
  const parsed = parseStripeSignature(header)
  if (!parsed) return false
  const expected = Buffer.from(signStripePayload(rawBody, secret, parsed.t), 'hex')
  let ok = false
  // Check every candidate (no early exit) so timing doesn't reveal which one matched.
  for (const candidate of parsed.v1) {
    const given = Buffer.from(candidate, 'hex')
    if (given.length === expected.length && timingSafeEqual(given, expected)) ok = true
  }
  return ok
}
