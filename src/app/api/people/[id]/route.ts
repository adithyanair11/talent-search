import { HttpError } from '@/lib/http'
import { personIdSchema } from '@/lib/schemas/people'
import { getRequestContext } from '@/server/auth'
import { getPerson } from '@/server/people/service'
import { handleRouteError } from '@/server/route-error'

// No `runtime`/`dynamic` exports: Next 16 rejects them with cacheComponents (see api/plan/route.ts).

/**
 * `GET /api/people/{id}` → one candidate: profile, experiences (company, logo, title, years, description),
 * education and skills. A malformed id is indistinguishable from an unknown one: both are 404.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    const ctx = await getRequestContext(req)
    const { id } = await params
    const parsed = personIdSchema.safeParse(id)
    if (!parsed.success) throw new HttpError('not_found', 'Candidate not found.')
    return Response.json(await getPerson(ctx, parsed.data), { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (err) {
    return handleRouteError(err)
  }
}
