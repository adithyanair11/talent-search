---
name: api-route
description: Implement or change a Next.js App Router API route that follows the project's API contract, auth, validation, error and layering conventions, with tests. Use for any file under src/app/api.
---

API route task:

$ARGUMENTS

1. Check the exact contract for this route in CLAUDE.md (path, method, body, response shape, status
   codes). Response shapes are graded — match them exactly.
2. Route handler (`src/app/api/.../route.ts`) stays thin:
   - `export const runtime = 'nodejs'` and `export const dynamic = 'force-dynamic'`
   - `params` is a Promise in Next 16: `const { id } = await params`
   - authenticate via `src/server/auth.ts` (Bearer token OR cookie session) → 401 if missing/invalid
   - validate params/query/body with zod schemas from `src/lib/schemas` → 400/422
   - call ONE service in `src/server/`; map known errors to statuses with the shared error helper
   - return `NextResponse.json(...)`; never return raw DB errors, stack traces or SQL
3. Services in `src/server/` (`import 'server-only'`) use a Supabase client created with the caller's
   access token so RLS applies. Use the admin client only where CLAUDE.md allows it.
4. Cross-tenant access must look like "not found" (404), not "forbidden" — don't confirm existence.
5. Idempotency where the contract says so (e.g. adding a person twice → 200/201 with no change).
6. Tests (vitest) for: happy path, 401 without token, 400/422 bad input, 404 other company's resource,
   and any idempotency/limit rule. Prefer integration tests against local Supabase using the two seeded
   recruiters.
7. Smoke-test with curl against `make dev` using a real token (the seed script prints how to get one).
8. Run typecheck, lint, tests. Summarize. Do not commit.
