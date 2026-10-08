import 'server-only'

import { unstable_rethrow } from 'next/navigation'

import { toErrorResponse } from '@/lib/http'

/**
 * The `catch` of every route handler. Next's own control-flow errors (prerender bail-out when a handler reads
 * the request, redirect, notFound) must propagate; everything else becomes the `{ error }` JSON shape.
 */
export function handleRouteError(err: unknown): Response {
  unstable_rethrow(err)
  return toErrorResponse(err)
}
