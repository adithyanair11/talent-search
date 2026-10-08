import { getRequestContext } from '@/server/auth'
import { getPlan } from '@/server/plan'
import { handleRouteError } from '@/server/route-error'

// No `runtime`/`dynamic` exports: Next 16 rejects them with cacheComponents. Reading the request makes this
// handler dynamic, and the default runtime is Node.
/** `GET /api/plan` → `{ plan: "free" | "paid", searches_remaining: number | null }`. */
export async function GET(req: Request): Promise<Response> {
  try {
    const ctx = await getRequestContext(req)
    return Response.json(await getPlan(ctx), { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    return handleRouteError(err)
  }
}
