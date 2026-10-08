# Decisions

Non-obvious choices, newest last. Feeds the README.

## Scaffold

- **Supabase CLI pinned as a devDependency (`supabase@2.119.0`) and always run via `npx supabase`.**
  No global install, so a fresh clone gets the exact CLI version from `npm ci`.
- **`supabase/config.toml` `project_id = "talent-search"` set explicitly.** `supabase init` derives it from the
  folder name, which produced `talent-search_` here (the checkout folder ends with a space). An explicit id keeps
  Docker container/volume names stable regardless of where the repo is cloned.
- **Auth:** email/password only; `[auth] enable_signup = false` since sign-up is out of scope; recruiters are
  created by `scripts/seed.ts` via the admin API. `[auth.email] enable_signup` must stay `true`: the CLI maps it
  to the whole email provider, and `false` made every password login fail with "Email logins are disabled". Email confirmations off. `site_url` is
  `http://localhost:3000`.
- **Env:** `scripts/setup-env.ts` regenerates `.env.local` from `npx supabase status -o env` on every setup
  (`API_URL`, `PUBLISHABLE_KEY`, `SECRET_KEY`, with fallbacks to the legacy `ANON_KEY` / `SERVICE_ROLE_KEY`).
  `OPENAI_API_KEY`, `STRIPE_WEBHOOK_SECRET` and `OPENAI_MODEL` come from the shell, or are kept from an existing
  `.env.local`. Next.js already gives real environment variables precedence over `.env.local`.
- **shadcn/ui `new-york` style, `neutral` base color, configured by a hand-written `components.json`.**
  shadcn CLI 4.x replaced styles with interactive "presets" in `init`. `new-york` is still served by the registry,
  so we wrote `components.json` and `globals.css` (the registry's neutral Tailwind v4 oklch variables) ourselves,
  then ran `shadcn add index <components>` non-interactively.
- **Kept the Next.js 16.4 template defaults `cacheComponents` and `partialPrefetching`.** Dynamic data (session
  cookies, per-request reads) must therefore sit inside `<Suspense>` or route handlers. Added stable
  `typedRoutes: true`.
- **`images.remotePatterns`:** every avatar and company logo URL in `data/candidates.json` is
  `https://rotto.com/rotto/...`, so only that host + path prefix is allowed.
- **npm 11 `allowScripts`:** install scripts are approved per package (`esbuild`, `unrs-resolver`) in
  `package.json`; the Supabase CLI package needs none.
- **Unimplemented scripts** (`eval`, `replay:stripe`, `test:quota`, `bench`) are stubs
  that exit 0 so `make setup` and the npm scripts work before each feature lands.

## Search semantics (from data analysis)

Full evidence in `docs/data-notes.md` §3 — each rule reproduces the sample `expected_ids` with precision and recall
1.000, and the alternatives were measured and rejected.

- **Seniority words are exact levels** (`seniority` field): "senior" excludes staff (senior-or-above gives P 0.40).
- **"Has worked at a startup/company" = any experience**, current or past (current-only gives R 0.90).
- **Skills match exact canonical names, several skills are ANDed** ("React" never matches "React Native"; OR gives P 0.20).
- **"Enterprise sales experience" is the skill `Enterprise Sales`**, not `company_type = enterprise` (P 0.71, R 0.68).
- **A place name is a city**; only an explicit state name/code filters by state ("San Francisco" ≠ CA).
- **A material requirement the data can't express (e.g. spoken languages) yields 0 results** with an `unsupported` note.

## Schema & tenancy

- **Candidates are one row each: scalar columns plus `experiences` / `education` as ordered jsonb arrays, with
  stored generated search columns** (`skills_key`, `city_key`, `state_key`, `title_key`, `companies_key`,
  `company_types`, `current_company_type`, `degrees`, `schools_key`, `fields_key`) and a GIN or btree index on each.
  Every search predicate in data-notes §3 is then a row-level check on one table: no joins, no duplicate rows, no
  `EXISTS` subqueries, and generated columns can never drift from the source. Child tables would add joins for
  5,000 rows and nothing the search needs. The detail endpoint returns the jsonb as-is.
- **Search keys are lower-cased (state upper-cased)**, so normalized filter values match case-insensitively with
  plain `=` / `@>` / `&&`. The helpers that build them (`private.jsonb_texts`, `private.lower_texts`) are
  `immutable`, as generated columns require.
- **No trigram indexes.** The data is a closed vocabulary (data-notes §2) and search matches normalized exact
  values; fuzzy text matching would only add false positives ("React" ~ "React Native").
- **Candidate id is the dataset's text id (`cand_0629`), and `searches.result_ids` is `text[]`.** The grader and
  `data/queries.json` compare these exact ids, so the API returns them with no mapping layer.
- **Writes are limited by column-level grants as well as RLS.** Recruiters may insert/update only `name`
  (shortlists), `shortlist_id, person_id` (shortlist_people) and `brief, filters` (saved_briefs). `company_id`
  comes from the `private.current_company_id()` default, is checked in `WITH CHECK`, and a `BEFORE UPDATE`
  trigger rejects any change to it. That gives three independent layers.
- **`shortlist_people.company_id` must equal its shortlist's company**, enforced by a composite FK
  `(shortlist_id, company_id) → shortlists(id, company_id)`. FK checks bypass RLS, so adding a person to another
  company's list fails on the FK even though the caller can't see that list.
- **`FORCE ROW LEVEL SECURITY` only on the recruiter-writable tables** (shortlists, shortlist_people,
  saved_briefs). Server-written tables are changed only by `security definer` functions or the service role;
  both run as BYPASSRLS roles locally (`postgres`, `service_role`), so `FORCE` would add nothing there.
- **Recruiters can read their own company's `searches` and `subscriptions`** (needed for paging and plan display)
  but cannot write them. `stripe_events` has RLS on and no policy, so it is invisible to every API role.
- **`private.company_is_paid(company)` returns true only for the caller's own company or the service role.**
  Any other company reads as unpaid, so it can't be used to learn another tenant's plan.
- **Scripts that import `src/server/*` run with `tsx --conditions=react-server`** (`npm run seed`,
  `npm run probe:security`). `server-only` throws outside the react-server condition, and the condition lets
  scripts reuse `src/server/supabase-admin.ts`, the single place the secret key is read. Scripts load
  `.env.local` with `process.loadEnvFile`, which never overrides real environment variables.
- **`scripts/probe-security.ts` uses the admin client only to create and remove fixtures** (globex rows in
  searches, subscriptions and stripe_events, which no recruiter can write). Every attack runs with the acme
  recruiter's token or with no token. API cases are skipped until the routes exist (a non-JSON 404 means the
  route isn't implemented yet).

## Design system

- **Type scale replaces Tailwind's defaults** (`text-sm` = 13px, `text-base` = 14px body, `text-lg` = 16px)
  instead of adding new names. shadcn primitives then render at product density without edits. Inputs and
  textareas use `text-lg` below `md` so iOS Safari doesn't zoom on focus.
- **`shadow-xs`/`shadow-sm` render nothing; `shadow-md+` all map to one overlay shadow.** This enforces
  "hairline first, shadow only for overlays" without forking every shadcn component.
- **shadcn's `--accent` stays a neutral hover surface.** The single brand hue is `--primary` (+ `--primary-subtle`
  for selection). Renaming would break shadcn primitives, so the trap is documented in design.md instead.
- **Company logos sit on a white tile in both themes.** The vendored logos are designed for light backgrounds.
- **`/dev/design` stays reachable in production but is unlinked and `noindex`.** It renders only static
  fixtures (four records copied from `data/candidates.json`), calls no APIs and has no secrets, so hiding it
  behind a 404 would only make design review harder.
- **No checkout CTA in UpgradeDialog.** Real checkout is out of scope and the Stripe API is never called. The
  dialog explains the limit and says the plan updates automatically once the billing webhook confirms it.
- **Sheet vs Drawer is chosen with `useSyncExternalStore(matchMedia)`.** It returns `false` on the server. That
  is safe because the sheet only opens after user interaction. Persistent layout (sidebar vs tab bar) uses CSS
  breakpoints, so the first paint is right.

## Auth & app shell

- **One auth entry point for API routes: `getRequestContext(req)`.** If an `Authorization` header is present it
  must be `Bearer <jwt>` (a malformed header is a 401, never a silent fall-back to cookies); otherwise the
  `@supabase/ssr` cookie session is used. The JWT is verified with `auth.getClaims()` (signature + expiry), and
  the company is read through the caller's own RLS client (`companies` only returns their row). A valid user with
  no recruiter row gets 401, the same as no session. `getClaims` *throws* on undecodable tokens, so it is wrapped.
- **Route handlers export neither `runtime` nor `dynamic`.** With `cacheComponents`, Next 16 rejects both segment
  configs ("not compatible with `nextConfig.cacheComponents`"). Reading the request already makes a handler dynamic,
  and Node is the default runtime.
- **Server Components read the session after `await connection()`.** `getClaims` checks expiry against the clock,
  and Next flags `Date.now()` during prerendering. The session read lives in `<Account>` behind `<Suspense>`, so the
  rest of the frame streams immediately. It is wrapped in `React.cache` because the account menu renders twice
  (sidebar + mobile top bar).
- **`proxy.ts` refreshes the session on pages and `/api/*`, redirects only pages.** Signed-out page requests go
  to `/login?next=…` (`next` must be a same-origin path, checked on the client to block open redirects). API
  routes answer 401 JSON themselves. Bearer API calls skip the cookie work. `/api/billing/events` is excluded by
  the matcher. A signed-in visit to `/login` is *not* bounced back to the app: a session without a recruiter row is
  sent to `/login`, and bouncing it would loop. `/dev/design` stays public (static fixtures only).
- **Sign-in/out run in the browser with the Supabase browser client** (it writes the auth cookies). Sign-out uses
  `scope: "local"` (this browser only) and clears the React Query cache, so nothing from one company is shown to
  the next recruiter on the same tab. The 401 handler in the QueryClient sends an expired session to `/login`.
- **Demo credentials are shown on the login page.** No sign-up or reset is in scope, so graders need a way in. The
  accounts and password are the ones `scripts/seed.ts` creates for the local stack only. They grant nothing beyond
  the local demo.
- **Company identity is a monogram tile.** Companies have no logo in the data. The company name + menu (email, Sign
  out) sits in the sidebar header on desktop and the top bar on mobile, per the design system's AppShell.
- **`GET /api/plan` reads `companies.searches_used` and the company's `active`/`trialing` subscriptions with the
  caller's RLS client.** `private.company_is_paid()` isn't reachable over PostgREST (the `private` schema isn't
  exposed); recruiters can SELECT their own subscriptions, so the same rule is applied in `src/lib/plan.ts`
  (`FREE_SEARCH_LIMIT = 1`, `PAID_STATUSES`). `run_search` must use the same limit when it lands.
- **Vitest aliases `server-only` to its no-op build and loads `.env.local` via `scripts/lib/env.ts`.** Route
  handlers are tested by calling `GET(new Request(...))` against local Supabase with the seeded recruiters; the suite
  skips itself when Supabase isn't running.
