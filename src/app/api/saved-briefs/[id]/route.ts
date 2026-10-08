import { HttpError } from '@/lib/http'
import { savedBriefIdSchema } from '@/lib/schemas/saved-briefs'
import { getRequestContext } from '@/server/auth'
import { handleRouteError } from '@/server/route-error'
import { deleteSavedBrief } from '@/server/saved-briefs/service'

// No `runtime`/`dynamic` exports: Next 16 rejects them with cacheComponents (see api/plan/route.ts).

type Params = { params: Promise<{ id: string }> }

/** `DELETE /api/saved-briefs/{id}` → 204. A malformed id, another company's or a deleted one: all 404. */
export async function DELETE(req: Request, { params }: Params): Promise<Response> {
  try {
    const ctx = await getRequestContext(req)
    const parsed = savedBriefIdSchema.safeParse((await params).id)
    if (!parsed.success) throw new HttpError('not_found', 'Saved search not found.')
    await deleteSavedBrief(ctx, parsed.data)
    return new Response(null, { status: 204 })
  } catch (err) {
    return handleRouteError(err)
  }
}
