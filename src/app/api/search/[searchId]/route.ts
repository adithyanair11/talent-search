import { HttpError } from '@/lib/http'
import { pageSchema, searchIdSchema } from '@/lib/schemas/search'
import { getRequestContext } from '@/server/auth'
import { handleRouteError } from '@/server/route-error'
import { getSearchPage } from '@/server/search/service'

/**
 * `GET /api/search/{search_id}?page=N` → `{ search_id, filters, total, page, results }` from the stored snapshot.
 * Never counts as a search. A page past the end returns `results: []`.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ searchId: string }> },
): Promise<Response> {
  try {
    const ctx = await getRequestContext(req)
    const { searchId } = await params
    const id = searchIdSchema.safeParse(searchId)
    if (!id.success) throw new HttpError('bad_request', 'search_id must be a UUID.')
    const page = pageSchema.safeParse(new URL(req.url).searchParams.get('page') ?? undefined)
    if (!page.success) throw new HttpError('bad_request', 'page must be an integer ≥ 1.')
    return Response.json(await getSearchPage(ctx, id.data, page.data), {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (err) {
    return handleRouteError(err)
  }
}
