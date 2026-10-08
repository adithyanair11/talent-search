/**
 * The API's error shape, shared by route handlers (server) and the API client (browser).
 * Every non-2xx response body is `{ error: { code, message } }`; messages are safe to show a recruiter.
 */
import { ZodError } from 'zod'

export const ERROR_STATUS = {
  bad_request: 400,
  unauthorized: 401,
  payment_required: 402,
  not_found: 404,
  conflict: 409,
  unprocessable: 422,
  /** Too many searches in a short time (per-recruiter token bucket). Sent with `Retry-After`. */
  rate_limited: 429,
  internal: 500,
  /** A dependency (the LLM) is slow or down; nothing was consumed. Sent with `Retry-After`. */
  search_unavailable: 503,
} as const

export type ErrorCode = keyof typeof ERROR_STATUS

export type ErrorBody = { error: { code: string; message: string } }

/** Throw from services or handlers; `toErrorResponse` maps it to its status and JSON body. */
export class HttpError extends Error {
  readonly code: ErrorCode
  readonly status: number
  readonly retryAfterSeconds?: number

  constructor(code: ErrorCode, message: string, options: { retryAfterSeconds?: number } = {}) {
    super(message)
    this.name = 'HttpError'
    this.code = code
    this.status = ERROR_STATUS[code]
    this.retryAfterSeconds = options.retryAfterSeconds
  }
}

export function errorResponse(code: ErrorCode, message: string, retryAfterSeconds?: number): Response {
  const body: ErrorBody = { error: { code, message } }
  const headers = retryAfterSeconds === undefined ? undefined : { 'Retry-After': String(retryAfterSeconds) }
  return Response.json(body, { status: ERROR_STATUS[code], headers })
}

/** Maps any thrown value to a safe JSON error. Unknown errors are logged and become a generic 500. */
export function toErrorResponse(err: unknown): Response {
  if (err instanceof HttpError) return errorResponse(err.code, err.message, err.retryAfterSeconds)
  if (err instanceof ZodError) {
    const issue = err.issues[0]
    const where = issue?.path.length ? `${issue.path.join('.')}: ` : ''
    return errorResponse('bad_request', `${where}${issue?.message ?? 'Invalid request'}`)
  }
  console.error('[api] unhandled error', err)
  return errorResponse('internal', 'Something went wrong. Please try again.')
}

/** Narrows an unknown JSON body to the error shape (used by the API client). */
export function isErrorBody(value: unknown): value is ErrorBody {
  if (typeof value !== 'object' || value === null || !('error' in value)) return false
  const error = (value as { error: unknown }).error
  return (
    typeof error === 'object' &&
    error !== null &&
    typeof (error as { code?: unknown }).code === 'string' &&
    typeof (error as { message?: unknown }).message === 'string'
  )
}
