import { afterEach, describe, expect, it, vi } from 'vitest'

import { api, ApiError } from './api-client'

function mockFetch(impl: () => Promise<Response>) {
  vi.stubGlobal('fetch', vi.fn(impl))
}

afterEach(() => vi.unstubAllGlobals())

describe('api client', () => {
  it('returns parsed JSON on success and sends cookies', async () => {
    mockFetch(async () => Response.json({ plan: 'free', searches_remaining: 1 }))
    await expect(api.get('/api/plan')).resolves.toEqual({ plan: 'free', searches_remaining: 1 })
    expect(vi.mocked(fetch).mock.calls[0][1]).toMatchObject({ method: 'GET', credentials: 'same-origin' })
  })

  it('throws a typed ApiError from the error body', async () => {
    mockFetch(async () => Response.json({ error: { code: 'payment_required', message: 'No searches left' } }, { status: 402 }))
    const err = await api.post('/api/search', { brief: 'x' }).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect(err).toMatchObject({ status: 402, code: 'payment_required', message: 'No searches left', isClientError: true })
  })

  it('handles non-JSON errors and network failures', async () => {
    mockFetch(async () => new Response('<html>oops</html>', { status: 502 }))
    await expect(api.get('/api/plan')).rejects.toMatchObject({ status: 502, code: 'unknown', isClientError: false })

    mockFetch(async () => {
      throw new TypeError('Failed to fetch')
    })
    await expect(api.get('/api/plan')).rejects.toMatchObject({ status: 0, code: 'network' })
  })
})
