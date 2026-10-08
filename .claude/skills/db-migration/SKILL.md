---
name: db-migration
description: Write or change Supabase Postgres schema, RLS policies, indexes and SQL functions as a new migration, then prove tenant isolation still holds. Use for any database change.
---

Database change:

$ARGUMENTS

1. Read existing migrations in `supabase/migrations/` and the tenancy rules in CLAUDE.md.
2. Create a NEW migration with `npx supabase migration new <short_name>`. Never edit an already
   applied migration once the user has committed it.
3. For every table you create or touch:
   - `alter table ... enable row level security;` (and `force row level security` on tenant tables)
   - explicit policies per operation; tenant tables use `company_id = private.current_company_id()` in
     both `USING` and `WITH CHECK`
   - `revoke` everything you don't intend from `anon` and `authenticated`, then `grant` the minimum
   - indexes for every filter/join path the search or API uses (GIN for arrays/jsonb/trigram as needed)
4. Every function:
   - `security invoker` unless it must bypass RLS; if `security definer`: `set search_path = ''`,
     fully-qualified names, verify `auth.uid()` and company, `revoke execute ... from public, anon`,
     grant only to the role that needs it
   - no dynamic SQL from input; if unavoidable use `format('%I', ...)` / `%L` or `EXECUTE ... USING`
   - internal helpers live in the `private` schema (not exposed by PostgREST)
5. Apply: `npx supabase db reset` (asks permission — it re-seeds), or `npx supabase migration up` when a
   reset isn't needed.
6. Prove it: run `npm run probe:security` (and add a case to it if this change creates a new surface).
   Also run `npx supabase db lint` and fix warnings about RLS or search_path.
7. Run `npm run typecheck` (regenerate types with `npx supabase gen types typescript --local > src/lib/database.types.ts`).
8. Summarize the schema/policy changes and the probe results. Do not commit.
