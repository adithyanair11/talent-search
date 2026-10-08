import { HttpError } from '@/lib/http'
import { searchRequestSchema } from '@/lib/schemas/search'
import { getRequestContext } from '@/server/auth'
import { handleRouteError } from '@/server/route-error'
import { runSearch } from '@/server/search/service'

// No `runtime`/`dynamic` exports: Next 16 rejects them with cacheComponents (see api/plan/route.ts).
/** `POST /api/search` `{ brief, filters? }` → `{ search_id, filters, total, results, searches_remaining }`. */
export async function POST(req: Request): Promise<Response> {
  try {
    const ctx = await getRequestContext(req)
    const body: unknown = await req.json().catch(() => {
      throw new HttpError('bad_request', 'Request body must be JSON.')
    })
    const input = searchRequestSchema.parse(body)
    return Response.json(await runSearch(ctx, input), { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    return handleRouteError(err)
  }
}
