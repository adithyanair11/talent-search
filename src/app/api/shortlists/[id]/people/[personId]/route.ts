import { HttpError } from '@/lib/http'
import { personIdSchema } from '@/lib/schemas/people'
import { shortlistIdSchema } from '@/lib/schemas/shortlists'
import { getRequestContext } from '@/server/auth'
import { handleRouteError } from '@/server/route-error'
import { addPerson, removePerson } from '@/server/shortlists/service'

// No `runtime`/`dynamic` exports: Next 16 rejects them with cacheComponents (see api/plan/route.ts).

type Params = { params: Promise<{ id: string; personId: string }> }

async function ids(params: Params['params']): Promise<{ shortlistId: string; personId: string }> {
  const { id, personId } = await params
  const list = shortlistIdSchema.safeParse(id)
  if (!list.success) throw new HttpError('not_found', 'Shortlist not found.')
  const person = personIdSchema.safeParse(personId)
  if (!person.success) throw new HttpError('not_found', 'Candidate not found.')
  return { shortlistId: list.data, personId: person.data }
}

/** `POST /api/shortlists/{id}/people/{person_id}` → 201 when added, 200 when already on the list (idempotent). */
export async function POST(req: Request, { params }: Params): Promise<Response> {
  try {
    const ctx = await getRequestContext(req)
    const { shortlistId, personId } = await ids(params)
    const result = await addPerson(ctx, shortlistId, personId)
    return Response.json(result, { status: result.added ? 201 : 200, headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    return handleRouteError(err)
  }
}

/** `DELETE /api/shortlists/{id}/people/{person_id}` → 204, also when they weren't on the list. */
export async function DELETE(req: Request, { params }: Params): Promise<Response> {
  try {
    const ctx = await getRequestContext(req)
    const { shortlistId, personId } = await ids(params)
    await removePerson(ctx, shortlistId, personId)
    return new Response(null, { status: 204 })
  } catch (err) {
    return handleRouteError(err)
  }
}
