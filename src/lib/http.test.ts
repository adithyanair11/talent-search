import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

import { errorResponse, HttpError, isErrorBody, toErrorResponse } from './http'

describe('http errors', () => {
  it('errorResponse uses the contract shape and status', async () => {
    const res = errorResponse('payment_required', 'No searches left')
    expect(res.status).toBe(402)
    expect(await res.json()).toEqual({ error: { code: 'payment_required', message: 'No searches left' } })
  })

  it('maps HttpError to its status', async () => {
    const res = toErrorResponse(new HttpError('not_found', 'Shortlist not found'))
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: { code: 'not_found', message: 'Shortlist not found' } })
  })

  it('maps ZodError to 400 with the first issue', async () => {
    const parsed = z.object({ brief: z.string().min(1) }).safeParse({ brief: '' })
    const res = toErrorResponse(parsed.error)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('bad_request')
    expect(body.error.message).toMatch(/^brief: /)
  })

  it('never leaks unknown error details', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = toErrorResponse(new Error('relation "public.secret" does not exist at line 3'))
    spy.mockRestore()
    expect(res.status).toBe(500)
    const text = await res.text()
    expect(text).not.toMatch(/relation|secret|line 3/)
    expect(JSON.parse(text).error.code).toBe('internal')
  })

  it('isErrorBody narrows only the exact shape', () => {
    expect(isErrorBody({ error: { code: 'x', message: 'y' } })).toBe(true)
    expect(isErrorBody({ error: 'x' })).toBe(false)
    expect(isErrorBody(null)).toBe(false)
    expect(isErrorBody({ plan: 'free' })).toBe(false)
  })
})
