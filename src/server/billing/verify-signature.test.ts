import { describe, expect, it } from 'vitest'

import { parseStripeSignature, signStripePayload, verifyStripeSignature } from './verify-signature'

const SECRET = 'whsec_test_secret'
const BODY = '{"id":"evt_1","type":"customer.subscription.created","created":1791211200}'
const T = '1791211200'
const sig = (body = BODY, secret = SECRET, t = T) => signStripePayload(body, secret, t)
const header = (...v1: string[]) => [`t=${T}`, ...v1.map((v) => `v1=${v}`)].join(',')

describe('verifyStripeSignature', () => {
  it('accepts a valid signature', () => {
    expect(verifyStripeSignature(BODY, header(sig()), SECRET)).toBe(true)
  })

  it('accepts the sample-file header shape t=…,v1=…', () => {
    expect(verifyStripeSignature(BODY, `t=${T},v1=${sig()}`, SECRET)).toBe(true)
  })

  it('accepts when any of several v1 signatures is valid (secret rotation)', () => {
    const other = sig(BODY, 'whsec_old')
    expect(verifyStripeSignature(BODY, header(other, sig()), SECRET)).toBe(true)
    expect(verifyStripeSignature(BODY, header(sig(), other), SECRET)).toBe(true)
  })

  it('rejects when no v1 is valid', () => {
    expect(verifyStripeSignature(BODY, header(sig(BODY, 'a'), sig(BODY, 'b')), SECRET)).toBe(false)
  })

  it('ignores other schemes such as v0', () => {
    expect(verifyStripeSignature(BODY, `t=${T},v0=${sig()}`, SECRET)).toBe(false)
    expect(verifyStripeSignature(BODY, `t=${T},v0=abc,v1=${sig()}`, SECRET)).toBe(true)
  })

  it('rejects the wrong secret', () => {
    expect(verifyStripeSignature(BODY, header(sig(BODY, 'whsec_other')), SECRET)).toBe(false)
  })

  it('rejects a tampered body', () => {
    expect(verifyStripeSignature(BODY.replace('evt_1', 'evt_2'), header(sig()), SECRET)).toBe(false)
    expect(verifyStripeSignature(`${BODY} `, header(sig()), SECRET)).toBe(false)
  })

  it('rejects a changed timestamp (t is signed)', () => {
    expect(verifyStripeSignature(BODY, `t=1791211201,v1=${sig()}`, SECRET)).toBe(false)
  })

  it('rejects a missing or empty header', () => {
    expect(verifyStripeSignature(BODY, null, SECRET)).toBe(false)
    expect(verifyStripeSignature(BODY, undefined, SECRET)).toBe(false)
    expect(verifyStripeSignature(BODY, '', SECRET)).toBe(false)
  })

  it.each([
    ['no t', `v1=${'a'.repeat(64)}`],
    ['no v1', `t=${T}`],
    ['empty t', `t=,v1=${'a'.repeat(64)}`],
    ['non-numeric t', `t=abc,v1=${'a'.repeat(64)}`],
    ['duplicate t', `t=${T},t=${T},v1=${'a'.repeat(64)}`],
    ['non-hex v1', `t=${T},v1=${'z'.repeat(64)}`],
    ['short v1', `t=${T},v1=abcd`],
    ['uppercase v1', `t=${T},v1=${'A'.repeat(64)}`],
    ['part without =', `t=${T},garbage`],
    ['garbage', 'not a signature'],
  ])('rejects a malformed header (%s)', (_, value) => {
    expect(parseStripeSignature(value)).toBeNull()
    expect(verifyStripeSignature(BODY, value, SECRET)).toBe(false)
  })

  it('handles an empty body: valid only if the empty body was signed', () => {
    expect(verifyStripeSignature('', header(sig('')), SECRET)).toBe(true)
    expect(verifyStripeSignature('', header(sig()), SECRET)).toBe(false)
  })

  it('rejects everything when the secret is empty', () => {
    expect(verifyStripeSignature(BODY, header(sig(BODY, '')), '')).toBe(false)
  })

  it('tolerates whitespace around parts', () => {
    expect(verifyStripeSignature(BODY, `t=${T}, v1=${sig()}`, SECRET)).toBe(true)
  })
})
