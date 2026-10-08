import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/** Pages reachable without a session. */
const PUBLIC_PAGES = ['/login', '/dev/design']

/**
 * Runs before every page and API request (see `config.matcher`):
 * 1. refreshes the Supabase session cookie so Server Components and route handlers see a current token;
 * 2. redirects signed-out page requests to /login. (A signed-in visit to /login is left alone: a user with a
 *    valid session but no recruiter row is sent there by the app, and bouncing them back would loop.)
 * API routes are never redirected; they answer 401 JSON themselves. Bearer-token API calls skip the
 * cookie work entirely. The Stripe webhook is excluded by the matcher, so it reaches its handler untouched.
 */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl
  const isApi = pathname.startsWith('/api/')
  if (isApi && request.headers.has('authorization')) return NextResponse.next()

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  if (!url || !key) return NextResponse.next()

  let response = NextResponse.next({ request })
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet, headers) => {
        for (const { name, value } of toSet) request.cookies.set(name, value)
        response = NextResponse.next({ request })
        for (const { name, value, options } of toSet) response.cookies.set(name, value, options)
        for (const [name, value] of Object.entries(headers ?? {})) response.headers.set(name, value)
      },
    },
  })

  // Verifies the JWT and refreshes it when expired. Nothing may run between client creation and this.
  const { data } = await supabase.auth.getClaims()
  const signedIn = Boolean(data?.claims?.sub)
  if (isApi) return response

  const isPublic = PUBLIC_PAGES.some((p) => pathname === p || pathname.startsWith(`${p}/`))
  if (!signedIn && !isPublic) {
    const login = new URL('/login', request.url)
    if (pathname !== '/') login.searchParams.set('next', pathname + search)
    return withCookies(NextResponse.redirect(login), response)
  }
  return response
}

/** Carries refreshed session cookies over to a redirect response. */
function withCookies(target: NextResponse, source: NextResponse): NextResponse {
  for (const cookie of source.cookies.getAll()) target.cookies.set(cookie)
  return target
}

export const config = {
  matcher: [
    // Everything except static assets, image optimisation, and the Stripe webhook (no session there).
    '/((?!_next/static|_next/image|api/billing/events|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
