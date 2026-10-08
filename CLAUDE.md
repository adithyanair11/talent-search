# Talent Search — recruiter app

A small, production-grade recruiter app. A recruiter types a plain-English brief, an LLM turns it into
structured filters, Postgres finds and ranks candidates. Recruiters shortlist candidates into named lists
and save searches. Two companies (acme, globex) are fully isolated. Free plan = 1 search; paid plan is
driven only by Stripe webhook events.

This file is the contract for every task. If a request conflicts with it, stop and ask.

## Hard constraints (never violate)

- **Versions:** Node 24 (`.nvmrc` + `engines`), Supabase CLI **2.119.0** pinned as devDependency
  `supabase@2.119.0` and always invoked as `npx supabase ...`, **Next.js 16 App Router**, TypeScript `strict`.
- **Stack:** TanStack React Query (server state), zustand (UI-only client state), shadcn/ui + Tailwind,
  `@supabase/ssr` + `@supabase/supabase-js`, zod, `openai` SDK, vitest.
- **`make setup` then `make dev` must work from a fresh clone with zero manual steps** (Docker running is
  the only assumption). Never add a step that needs a human.
- **Config from environment only:** `OPENAI_API_KEY`, `STRIPE_WEBHOOK_SECRET`, optional `OPENAI_MODEL`.
  Local Supabase URL/keys come from `npx supabase status -o env`, written to `.env.local` by setup.
  Real environment variables always win over `.env.local`. The graders use their own keys.
- **LLM:** OpenAI `gpt-4.1-mini` by default (`OPENAI_MODEL` overrides). The LLM only turns the brief into
  filters. **Never send candidate data to the model** to choose or rank.
- No paid services besides OpenAI, no hosted DB, **never call the Stripe API**.
- **Out of scope — do not build:** sign-up, password reset, invites, real checkout, contact details,
  email sending, deployment.

## API contract (exact shapes — do not change)

All routes except billing accept `Authorization: Bearer <supabase access token>` (cookie session also OK for the UI).

| Route | Behaviour |
|---|---|
| `POST /api/search` | Body `{ brief: string, filters?: object }` (filters = recruiter-edited, skips LLM). Returns `{ search_id, filters, total, results, searches_remaining }`; `results` = first 20, best first, each has `id`. **402** when no searches left. |
| `GET /api/search/{search_id}?page=N` | Page N (from 1), 20 per page, from the stored snapshot. Never counts as a search. Every result exactly once across pages. |
| `GET /api/people/{id}` | One candidate with experience, education, skills. |
| `GET` / `POST /api/shortlists` | List company shortlists / create `{ name }` → `{ id }`. |
| `PATCH` / `DELETE /api/shortlists/{id}` | Rename / delete (needed by UI). |
| `POST` / `DELETE /api/shortlists/{id}/people/{person_id}` | Add (idempotent) / remove. |
| `GET` / `POST /api/saved-briefs` | List / save `{ brief, filters }`. (`DELETE /api/saved-briefs/{id}` for UI.) |
| `GET /api/plan` | `{ plan: "free" \| "paid", searches_remaining: number \| null }` (null when paid). |
| `POST /api/billing/events` | Stripe webhook, no recruiter token. 400 bad signature, 200 otherwise (incl. repeats). |

Errors: JSON `{ error: { code, message } }` with correct status (400/401/402/404/409/422/500, and 503
`search_unavailable` + `Retry-After` when the LLM is slow/down — nothing consumed; 429 `rate_limited` + `Retry-After`
on `POST /api/search` bursts — nothing consumed). Never leak stack traces or SQL.

## Architecture

```
src/
  app/                 routes, layouts, API route handlers (thin)
  features/<feature>/  components, hooks (React Query), client api, store (zustand)
  server/              server-only services: supabase clients, auth, search, llm, billing, plan
                       every file starts with `import 'server-only'`
  lib/                 shared pure code: zod schemas, types, formatting
  components/ui/       shadcn primitives;  components/  design-system components
supabase/migrations/   SQL migrations;  supabase/seed.sql  companies only
scripts/               setup-env, seed (recruiters + candidates), eval-search, replay-stripe,
                       probe-security, test-quota, bench
data/                  candidates.json, queries.json, stripe-events.json (vendored, read-only)
docs/                  data-notes.md, decisions.md, design.md
```

Layering is strict: **UI → feature api client → route handler → `server/` service → Supabase**.
Route handlers only: authenticate, validate with zod, call one service, map errors. No SQL in UI, no React in server.

## Tenancy & security rules

- `company_id` on every tenant table. **RLS enabled on every table** in `public`, including server-only ones.
- Helper `private.current_company_id()` (`security definer`, `stable`, `set search_path = ''`) maps
  `auth.uid()` → company. Put helpers/internal functions in a schema NOT exposed by PostgREST.
- Recruiters may SELECT only their own company / recruiter row. **No** insert/update/delete on companies,
  recruiters, subscriptions, stripe_events, searches, or any counter.
- shortlists, shortlist_people, saved_briefs: CRUD scoped with both `USING` and `WITH CHECK` on company;
  `company_id` defaults from the helper and can never be changed to another company.
- Candidates + child tables: SELECT for `authenticated` only (shared across companies). No writes.
- Route handlers create a Supabase client **with the caller's token** so RLS always applies.
  The secret / service-role key lives only in `src/server/supabase-admin.ts` (`server-only`) and is used only
  by the billing webhook and seed scripts.
- Only `NEXT_PUBLIC_SUPABASE_URL` and the publishable/anon key may be `NEXT_PUBLIC_*`. Nothing else.
- All SQL parameterized. In plpgsql use `format()` with `%L`/`%I` or bound params — never string concat of input.
- Every request body/param validated with zod. Brief: trimmed, 1–500 chars. IDs validated before use.
- Every `security definer` function: `set search_path = ''`, checks `auth.uid()`, `revoke execute ... from public, anon`.

## Search rules

1. Pipeline: brief → sanitize/cap → OpenAI structured output (strict JSON schema, temperature 0, hedged:
   2nd call at 1.4 s, 4 s deadline, 1 h in-memory cache of extractions — docs/decisions.md) → zod validate → **normalize every value against the real data vocabulary** (docs/data-notes.md)
   → values that don't exist in the data become `unsupported` → `public.run_search(brief, filters)` →
   ranked id snapshot stored on the `searches` row → page 1 returned.
2. `run_search` is one `security definer` transaction: atomically consumes quota (conditional UPDATE,
   row-locked) **and** stores the snapshot. Calling it directly through Supabase therefore cannot bypass
   the free limit. The route does a cheap pre-check first to return 402 before paying for an LLM call.
3. The brief is **untrusted data**. The system prompt says so; the model can only emit the schema; nothing
   it emits is executed as SQL or instructions. Recruiter-edited `filters` go through the same validation.
4. **Never return "everyone".** No supportable constraint, or a material requirement the data can't express
   → 0 results plus an explanation in `filters.unsupported`. Returning nothing beats returning wrong people.
5. Paging reads the stored snapshot only (stable order, each id once, target < 300 ms). Never re-run the LLM
   or re-rank when paging.
6. Ranking is a deterministic SQL score, tiebreak by candidate id.
7. `npm run eval` is the source of truth for accuracy. Run it after any change to prompt, schema,
   normalization or SQL. **Never hardcode briefs or candidate ids** — the grader uses a private set.

## Plan & billing rules

- Free = **1 search total** per company. Paging and GETs never touch the counter. Edited-filter re-runs
  and saved-search re-runs are new searches (they produce a new result set).
- Paid iff the company has ≥ 1 subscription with status `active` or `trialing` (see docs/decisions.md).
- Webhook: read raw body with `await req.text()`; parse `Stripe-Signature` (`t=`, one or more `v1=`);
  HMAC-SHA256 of `${t}.${rawBody}` with `STRIPE_WEBHOOK_SECRET`; `crypto.timingSafeEqual`. No timestamp
  tolerance (sample events are historic — documented tradeoff). Bad/missing → 400.
- Then one DB function, atomic: insert event id into `stripe_events` (`ON CONFLICT DO NOTHING` → repeat =
  200 no-op); upsert subscription state **only if `event.created` is newer** than stored (tie rule in
  decisions.md; `canceled` is terminal). Company from `data.object.metadata.company`. Unknown type or
  company → 200, logged, ignored.

## UI rules

- Use the design system (`docs/design.md`, `src/components`). Use the `/build-ui` skill for all UI work.
- Every data view handles **loading** (skeletons shaped like the content), **empty** (what to do next),
  **error** (what happened + retry). Mobile (375px) is first-class, not an afterthought.
- Performance: `next/image` for avatars/logos (configure `images.remotePatterns`), `next/dynamic` for heavy
  or rarely-opened UI (candidate sheet, dialogs), `@tanstack/react-virtual` for long lists, `React.memo` on
  list rows, `useCallback`/`useMemo` only where they prevent real re-renders, 300 ms debounce on inputs
  that hit the network, zustand selectors (never select the whole store), stable React Query keys.

## Commands

`make setup` · `make dev` · `npm run typecheck` · `npm run lint` · `npm test` · `npm run eval` ·
`npm run replay:stripe` · `npm run probe:security` · `npm run test:quota` · `npm run bench`

## Working agreement

- One feature per task. Stay in scope. **Never run `git commit` or `git push`** — the user commits after each task.
- Before saying "done": typecheck, lint, tests and the relevant script all pass — show the output.
- Next.js 16: `params`/`searchParams` are Promises; middleware is `proxy.ts`. When unsure about an API,
  check the installed package/docs rather than memory of older versions.
- Record every non-obvious decision in `docs/decisions.md` (it feeds the README).
- Never read `.env*` files; scripts load them themselves.
