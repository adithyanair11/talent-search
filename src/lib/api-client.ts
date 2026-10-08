/**
 * Browser client for the app's own API. Sends the session cookie, parses the `{ error: { code, message } }`
 * shape and throws `ApiError` so React Query and the UI can branch on `status` / `code`.
 */
import { isErrorBody } from './http'

export class ApiError extends Error {
  readonly status: number
  readonly code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }

  /** Client errors (4xx) won't succeed on retry. */
  get isClientError(): boolean {
    return this.status >= 400 && this.status < 500
  }
}

type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE'

export async function apiRequest<T>(
  method: Method,
  path: string,
  { body, signal }: { body?: unknown; signal?: AbortSignal } = {},
): Promise<T> {
  let res: Response
  try {
    res = await fetch(path, {
      method,
      credentials: 'same-origin',
      headers: body === undefined ? { Accept: 'application/json' } : { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    })
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err
    throw new ApiError(0, 'network', "Couldn't reach the server. Check your connection and try again.")
  }

  const data: unknown = res.status === 204 ? null : await res.json().catch(() => null)
  if (!res.ok) {
    if (isErrorBody(data)) throw new ApiError(res.status, data.error.code, data.error.message)
    throw new ApiError(res.status, 'unknown', 'Something went wrong. Please try again.')
  }
  return data as T
}

export const api = {
  get: <T>(path: string, signal?: AbortSignal) => apiRequest<T>('GET', path, { signal }),
  post: <T>(path: string, body?: unknown) => apiRequest<T>('POST', path, { body }),
  patch: <T>(path: string, body?: unknown) => apiRequest<T>('PATCH', path, { body }),
  delete: <T>(path: string) => apiRequest<T>('DELETE', path),
}
