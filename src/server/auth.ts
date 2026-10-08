import 'server-only'

import { connection } from 'next/server'
import { cache } from 'react'

import { HttpError } from '@/lib/http'

import { createSupabaseServerClient, createSupabaseTokenClient, type Supabase } from './supabase-server'

export type RequestContext = {
  /** RLS client acting as the caller. Every query through it is scoped by the database policies. */
  supabase: Supabase
  userId: string
  email: string | null
  companyId: string
  companySlug: string
  companyName: string
}

const BEARER = /^Bearer\s+([A-Za-z0-9._~+/=-]+)$/i
// A Supabase access token is a JWT of a few hundred bytes; anything far larger is not one.
const MAX_TOKEN_LENGTH = 4096

/**
 * Authenticates an API request: `Authorization: Bearer <access token>` if the header is present
 * (a malformed header is rejected, never silently ignored), otherwise the cookie session.
 * Throws `HttpError('unauthorized')` when there is no valid session or the user isn't a recruiter.
 */
export async function getRequestContext(req: Request): Promise<RequestContext> {
  const header = req.headers.get('authorization')
  if (header !== null) {
    const token = BEARER.exec(header.trim())?.[1]
    if (!token || token.length > MAX_TOKEN_LENGTH) {
      throw new HttpError('unauthorized', 'Authorization header must be "Bearer <access token>".')
    }
    const context = await resolve(createSupabaseTokenClient(token), token)
    if (!context) throw new HttpError('unauthorized', 'Your session is invalid or has expired. Sign in again.')
    return context
  }

  const context = await resolve(await createSupabaseServerClient())
  if (!context) throw new HttpError('unauthorized', 'Sign in to continue.')
  return context
}

/** Cookie-session context for Server Components; `null` when signed out. Deduplicated per request. */
export const getSessionContext = cache(async (): Promise<RequestContext | null> => {
  // Session reads are request-time only: JWT expiry checks use the clock, which can't be prerendered.
  await connection()
  return resolve(await createSupabaseServerClient())
})

/**
 * Verifies the JWT (signature + expiry, via `getClaims`) and maps the user to their company through
 * RLS: `companies` only ever returns the caller's own row, so no recruiter row → no context.
 */
async function resolve(supabase: Supabase, token?: string): Promise<RequestContext | null> {
  let claims
  try {
    const { data, error } = await supabase.auth.getClaims(token)
    if (error) return null
    claims = data?.claims
  } catch {
    // getClaims throws (rather than returning an error) on tokens that aren't decodable JWTs.
    return null
  }
  if (!claims?.sub || claims.role !== 'authenticated') return null

  const { data: company, error } = await supabase.from('companies').select('id, slug, name').maybeSingle()
  if (error) throw new Error(`company lookup failed: ${error.message}`)
  if (!company) return null

  return {
    supabase,
    userId: claims.sub,
    email: typeof claims.email === 'string' ? claims.email : null,
    companyId: company.id,
    companySlug: company.slug,
    companyName: company.name,
  }
}
