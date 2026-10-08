import { HttpError } from '@/lib/http'
import { savedBriefBodySchema, type SavedBriefsResponse } from '@/lib/schemas/saved-briefs'
import { getRequestContext } from '@/server/auth'
import { handleRouteError } from '@/server/route-error'
import { createSavedBrief, listSavedBriefs } from '@/server/saved-briefs/service'

// No `runtime`/`dynamic` exports: Next 16 rejects them with cacheComponents (see api/plan/route.ts).

const NO_STORE = { 'Cache-Control': 'private, no-store' }

/** `GET /api/saved-briefs` → the company's saved searches, newest first. */
export async function GET(req: Request): Promise<Response> {
  try {
    const ctx = await getRequestContext(req)
    const body: SavedBriefsResponse = { saved_briefs: await listSavedBriefs(ctx) }
    return Response.json(body, { headers: NO_STORE })
  } catch (err) {
    return handleRouteError(err)
  }
}

/** `POST /api/saved-briefs` `{ brief, filters }` → 201 `{ id }`. Filters must pass the canonical filter schema. */
export async function POST(req: Request): Promise<Response> {
  try {
    const ctx = await getRequestContext(req)
    const body: unknown = await req.json().catch(() => {
      throw new HttpError('bad_request', 'Request body must be JSON.')
    })
    const parsed = savedBriefBodySchema.parse(body)
    return Response.json(await createSavedBrief(ctx, parsed), { status: 201, headers: NO_STORE })
  } catch (err) {
    return handleRouteError(err)
  }
}
