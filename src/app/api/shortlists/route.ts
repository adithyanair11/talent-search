import { HttpError } from '@/lib/http'
import { shortlistBodySchema, type ShortlistsResponse } from '@/lib/schemas/shortlists'
import { getRequestContext } from '@/server/auth'
import { handleRouteError } from '@/server/route-error'
import { createShortlist, listShortlists } from '@/server/shortlists/service'

// No `runtime`/`dynamic` exports: Next 16 rejects them with cacheComponents (see api/plan/route.ts).

const NO_STORE = { 'Cache-Control': 'private, no-store' }

/** `GET /api/shortlists` → the company's lists, newest first, each with its count and up to 4 avatars. */
export async function GET(req: Request): Promise<Response> {
  try {
    const ctx = await getRequestContext(req)
    const body: ShortlistsResponse = { shortlists: await listShortlists(ctx) }
    return Response.json(body, { headers: NO_STORE })
  } catch (err) {
    return handleRouteError(err)
  }
}

/** `POST /api/shortlists` `{ name }` → 201 `{ id }`; 409 when the company already has a list with that name. */
export async function POST(req: Request): Promise<Response> {
  try {
    const ctx = await getRequestContext(req)
    const body: unknown = await req.json().catch(() => {
      throw new HttpError('bad_request', 'Request body must be JSON.')
    })
    const { name } = shortlistBodySchema.parse(body)
    return Response.json(await createShortlist(ctx, name), { status: 201, headers: NO_STORE })
  } catch (err) {
    return handleRouteError(err)
  }
}
