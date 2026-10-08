import { HttpError } from '@/lib/http'
import { shortlistBodySchema, shortlistIdSchema } from '@/lib/schemas/shortlists'
import { getRequestContext } from '@/server/auth'
import { handleRouteError } from '@/server/route-error'
import { deleteShortlist, getShortlist, renameShortlist } from '@/server/shortlists/service'

// No `runtime`/`dynamic` exports: Next 16 rejects them with cacheComponents (see api/plan/route.ts).

type Params = { params: Promise<{ id: string }> }

const NO_STORE = { 'Cache-Control': 'private, no-store' }

/** A malformed id is indistinguishable from another company's or a deleted list: all 404. */
async function listId(params: Params['params']): Promise<string> {
  const parsed = shortlistIdSchema.safeParse((await params).id)
  if (!parsed.success) throw new HttpError('not_found', 'Shortlist not found.')
  return parsed.data
}

/** `GET /api/shortlists/{id}` → the list with its people, most recently added first. */
export async function GET(req: Request, { params }: Params): Promise<Response> {
  try {
    const ctx = await getRequestContext(req)
    return Response.json(await getShortlist(ctx, await listId(params)), { headers: NO_STORE })
  } catch (err) {
    return handleRouteError(err)
  }
}

/** `PATCH /api/shortlists/{id}` `{ name }` → `{ id, name }`; 409 on a duplicate name. */
export async function PATCH(req: Request, { params }: Params): Promise<Response> {
  try {
    const ctx = await getRequestContext(req)
    const id = await listId(params)
    const body: unknown = await req.json().catch(() => {
      throw new HttpError('bad_request', 'Request body must be JSON.')
    })
    const { name } = shortlistBodySchema.parse(body)
    return Response.json(await renameShortlist(ctx, id, name), { headers: NO_STORE })
  } catch (err) {
    return handleRouteError(err)
  }
}

/** `DELETE /api/shortlists/{id}` → 204; its memberships go with it. */
export async function DELETE(req: Request, { params }: Params): Promise<Response> {
  try {
    const ctx = await getRequestContext(req)
    await deleteShortlist(ctx, await listId(params))
    return new Response(null, { status: 204 })
  } catch (err) {
    return handleRouteError(err)
  }
}
