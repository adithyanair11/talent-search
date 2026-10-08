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
  `.env.local`. Next.js already gives real environment variables precedence over `.env.local`. If
  `STRIPE_WEBHOOK_SECRET` is set nowhere, setup generates a random `whsec_local_…` so the webhook and
  `replay:stripe` work with no manual step. An exported secret (the grader's) always wins.
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
- **Unimplemented scripts** (originally `replay:stripe`, `test:quota`, `bench`) were stubs
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
- **`shadow-xs` renders nothing; `shadow-md+` all map to one overlay shadow.** This keeps shadcn's flat shadows
  from appearing without forking every primitive. (Since the redesign, `shadow-sm` is a soft card lift; see
  "Redesign" below.)
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
- **Auth UI resets itself when hidden, because routes are kept alive.** With `cacheComponents`, Next 16 keeps
  visited routes mounted in a hidden `<Activity>` and shows the same instance again, state included. Without the
  reset, `/login` came back after sign-out still showing "Signing in…" with the button disabled until a reload, and
  the account menu reopened on the next sign-in. `LoginForm` and `AccountMenu` therefore reset their mutation (and
  clear the password, or close the menu) in an effect cleanup, which React runs when `<Activity>` hides them.
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

## Search: extraction & eval

- **Two filter schemas.** `filtersSchema` (`src/lib/schemas/filters.ts`) holds canonical filters: zod enums built
  from `src/lib/vocabulary.ts`, which a unit test checks for exact equality with `data/candidates.json`. Search and
  recruiter-edited filters use it. The LLM emits `extractionSchema`, which has the same keys but **free-string
  values**. If the JSON schema used enums, strict decoding would force the model to coerce "Lead", "C++" or "Oakland"
  into the nearest valid value and return the wrong people. With free strings, the deterministic normalizer decides,
  and anything it can't map goes to `unsupported`.
- **Strict structured outputs need every key `required` and `additionalProperties: false`,** so "optional" is
  expressed as nullable (`anyOf [schema, null]`). The JSON schema is hand-written. A test checks that it is strict
  and that its keys match both zod schemas.
- **`unsupported` is `string[]`** (short phrases, ≤ 10 × 200 chars), as the task specified, not the
  `{term, reason}[]` sketched in data-notes §4. The normalizer adds its own notes (`skill "C++" is not in the data`).
- **`preferences: string[]` (informational, never a constraint).** Briefs like "…, ideally ex-startup" or
  "Kotlin a bonus" made the model put the nice-to-have into `unsupported`, which empties the whole search. Prompt
  wording alone did not fix it. A dedicated schema slot did. Preferences never narrow results. They are kept for the
  UI and for possible ranking boosts later.
- **Generic "engineer"/"developer" → the 7 `… Engineer` roles; "<skill> engineers" → those roles + the skill.**
  Without a role filter, "Python developers" would include Data Scientists. The engineering roles are derived from
  the vocabulary (`role` ends in " Engineer"), so this isn't a list kept by hand.
- **"US"/"USA" constrains nothing** (every candidate is in the US). It becomes neither a filter nor `unsupported`.
  data-notes §4 suggested `unsupported`, but that would return 0 results for a requirement everyone meets.
- **Normalizer never drops a term silently.** Every raw value maps to a canonical value or becomes an `unsupported`
  note. Lookup keys ignore case, spaces and punctuation but keep `+`/`#` (so "C++" never matches "C"), with a
  trailing-"s" plural fallback. Alias tables are general synonyms (NYC, k8s, CMU, master's → MS+MBA …). They are
  never rules written for a particular brief. "TF" is deliberately ambiguous (TensorFlow/Terraform) and stays
  unsupported.
- **`isSearchable(filters)`**: false when `unsupported` is non-empty or no constraint is set, giving 0 results
  ("never return everyone").
- **LLM call:** `chat.completions` with `response_format: json_schema` (strict), temperature 0,
  `max_completion_tokens` 400, `maxRetries: 0`. Slow calls and dropped connections are handled by a hedged second
  request (see "Search: hedged LLM request"; this replaced the original 2.5 s timeout + one network retry).
  429/5xx/4xx fail fast. Failures surface as `FilterExtractionError` (`unavailable` / `invalid_output` /
  `refused`), which the route will map to a JSON error.
- **Brief handling:** control/invisible characters removed, whitespace collapsed, length capped at 500, and `<`/`>`
  replaced with look-alike characters so the brief can't close its `<brief>` delimiter. The brief is only ever
  the final user message. The system prompt tells the model to ignore instructions in the brief and to keep them out
  of every field, including `unsupported`. Otherwise "ignore all rules… product designers" emptied the search.
  Few-shot briefs are invented. A test checks that none matches or closely overlaps a `data/queries.json` brief
  (word Jaccard < 0.4).
- **Eval backend: the real API.** `npm run eval` signs in as the globex recruiter, gives globex a fixture `active`
  subscription (`sub_eval_<ts>`) with the admin client, POSTs each brief to `/api/search` and pages through
  `GET /api/search/{id}` to collect every id. In `finally` it removes the fixture and the searches it created and
  restores globex's `searches_used`, so the run neither uses up nor is blocked by a real search, and `replay:stripe`
  is unaffected. It needs the app running (`make dev`, or `API_BASE_URL`). The earlier in-process temporary matcher
  was deleted; `run_search` uses the same predicates, and eval stayed at P/R 1.000.
- **Eval metrics:** for an empty expected set, returning nothing scores 1.0 and returning anyone scores 0. Page-1
  precision is the expected share of the first 20 results in rank order.

## Search: find & rank

- **`public.run_search(brief, filters)` is the only way a search row is created** (`security definer`, one
  transaction). It locks the company row (`select … for update`), checks the free limit, ranks, stores the id
  snapshot on `searches`, and increments `searches_used`. 25 concurrent requests therefore serialise on the lock,
  and exactly one succeeds (`npm run test:quota`). The route's `getPlan` pre-check only avoids paying for an LLM
  call. It is not what enforces the limit.
- **Quota errors use SQLSTATE `PT402`.** PostgREST maps `PTxxx` to HTTP xxx, so a direct supabase-js `rpc` call
  also gets a 402, and the service maps `PT402` to `payment_required`. Malformed filters raise `22023`, which maps to
  422. Any error rolls back the transaction, so nothing is consumed.
- **The counter increments for paid companies too.** It counts usage, and a paid plan reports `searches_remaining:
  null`. A company that cancels has used its free search if it searched while paid. The free limit (`1`) is a
  constant in the function, mirrored from `FREE_SEARCH_LIMIT` (`src/lib/plan.ts`).
- **The SQL never trusts the caller for "never everyone".** `run_search` can be called directly, so it re-checks:
  no constraint, or a non-empty `unsupported`, gives an empty snapshot. The server's normalizer decides what is
  material. Nice-to-haves go to `preferences`, so whatever reaches `unsupported` is a material requirement.
- **Static SQL only.** Every filter is read into a typed plpgsql local (`private.jsonb_text_array`, casts) and used in
  one fixed query as `(v_x is null or <predicate>)`. Values are only compared against the generated search columns,
  never executed.
- **Ranking (orders the hard-filtered set only, never filters it):** +3 per `skills_any` skill held; +3 per
  preference term matching a candidate's skill, company, company type, school, field or degree; +2 per requested
  skill among the candidate's top-3 (headline) skills; recency of the matching experience when filtering by
  company or company type (current job 3, previous 2, older 1); +1 open to work (unless that is a filter);
  + `years_experience / 100` (always < 1). Ties are broken by `id` (`collate "C"`). **There is no title-match
  component**, because `current_title` is exactly the seniority prefix plus the role (data-notes §1), and both are
  already hard filters.
- **Recruiter-edited filters run through the same normalizer** (`normalizeFilters(filtersToExtraction(f))`) after
  `filtersSchema` validation, so edited and extracted filters produce identical canonical forms. The LLM is skipped.
- **Paging: `public.search_page` is `security invoker`.** RLS on `searches` limits it to the caller's company. It
  slices the array before unnesting (`result_ids[a:b]` `with ordinality`), so it reads one page, not the whole
  snapshot. The route also reads the search row: no row (missing, or another company's) → 404. A page past the end
  → `results: []`. `GET` returns `{ search_id, filters, total, page, results }`. That is the POST shape minus
  `searches_remaining` (paging never touches the plan), plus `page`.
- **Results are `CandidateSummary` plus `headline`**, with the full skills array (3–6). The UI chooses how many to
  show.
- **LLM failures:** `refused` → 422; `unavailable`/`invalid_output` → 500 with a retry message. Both happen before
  `run_search`, so a failed extraction never uses up the free search. (503 isn't in the contract's status list.)
- **`test:quota`, `bench` and `eval` drive the running app over HTTP** (`scripts/lib/api.ts`). `withCompanyState`
  forces a company to free or paid with admin fixtures and always restores its subscriptions, counter and the
  searches it created. Bench on `make dev` (p95): new search 1.5 s, paging 13 ms.


## Search: tuning for generalization

The 10 public briefs were already at F1 1.000, so this pass targets the grader's private set (vague,
unanswerable, typo'd and hostile briefs). It uses two extra sets: `scripts/eval-extra.json` (15 briefs. Run it with
`npm run eval -- scripts/eval-extra.json`) and a throwaway held-out set of 8 briefs that was never used for tuning.
Each extra brief carries its hand-written SQL and a justification. The SQL reads only the raw columns (`role`,
`skills`, `city`, `experiences`/`education` jsonb), never the generated `*_key` columns or `run_search`, so the
expected sets don't depend on the code under test.

- **Vocabulary in the prompt.** The prompt now lists skills, schools and fields of study, as it already did for
  roles and cities. This is schema vocabulary, not candidate data. The model can then canonicalize ("SRE" →
  roles, obvious typos → the listed spelling). Unknown job nouns go into `roles` as written, so the normalizer
  decides. Before this, the model put "SRE" and corrected typos into `unsupported`, which emptied the search.
- **Not requirements:** subjective praise ("strong", "talented"…), urgency, and stray code/SQL/markup. Injection
  fragments are never reported in `unsupported`. Before this, "…Austin'); DROP TABLE …" returned 0 because the
  model reported "SQL injection attempt". The prompt's example words are invented and don't overlap the eval
  briefs. `prompt hygiene` tests now check both eval files.
- **Typo fallback in the normalizer** (`resolveFuzzy`, defence in depth behind the prompt). If the exact and plural
  lookups miss, the normalizer takes the closest vocabulary key by optimal-string-alignment distance. The budget
  is 0 edits under 5 characters (Go, R, Java, Rust, TS stay exact), 1 edit from 5 characters and 2 from 9. A match
  also needs the same first letter, neither key containing the other ("Washington DC" ≠ WA, "QA engineer" ≠ "ML
  engineer"), and every key at the best distance meaning the same value. Roles try the "<skill> engineer" split
  before fuzzing, so "Go engineer" can't become "ML engineer".
- **"Too vague" rule.** If the only constraint is the generic engineering group (from "engineers"/"developers",
  i.e. 7 roles and about 60% of the data), the normalizer adds an `unsupported` note, so the search returns 0 with
  an explanation. Any concrete constraint ("engineers in Denver", "Python developers") or a specific role makes it
  a real search. This is detected structurally (the alias resolved to `ENGINEERING_ROLES`), not from brief text.
- **Preferences are canonicalized** through the skill/school/field/company/company-type/degree lookups ("golang"
  → "Go"). That lets the existing `run_search` preference boost match them. They still never filter.
- **Results (macro F1):** public 1.000 → 1.000. Extra 0.867 → 1.000. Held-out 0.625 → 0.875. Latency was unchanged
  (bench p95: new search 1.3 s, paging 14 ms).
- **Known gaps (fail safe: 0 results + explanation, never wrong people):** "only ever worked at startups" would
  need a `scope: "all"` on company/company type. OpenAI tail latency occasionally exceeded the old 2.5 s timeout
  (2 of ~120 calls during tuning) and gave a 500. The hedged request below fixes that.

## Search: hedged LLM request

- **Problem:** OpenAI latency has a long tail. Over 50 unhedged calls: p50 1.31 s, p75 1.42 s, p90 1.70 s, p95 1.84 s,
  max 3.62 s. With a 2.5 s timeout about 2–3% of searches returned 500 ("couldn't interpret the brief"), and the
  grader scores those as 0. Retrying after a timeout can't fit in the ~3 s search budget.
- **Fix (`hedged()` in `src/server/llm/extract-filters.ts`):** start the call. If it hasn't answered by
  `HEDGE_AFTER_MS` = 1.4 s (≈ p75), start one identical second call. The first valid answer wins and the other is
  aborted. Everything is abandoned at `DEADLINE_MS` → 503 (below). At most `MAX_ATTEMPTS` = 2 calls.
- **Errors:** a dropped connection (non-timeout `APIConnectionError`) starts the second call immediately. This
  replaces the old single retry. 429/5xx/4xx fail fast when nothing else is running, so a bad key or rate limit
  isn't doubled. If a call fails while the other is still running, we wait for the other. Parsing and validation
  are part of each attempt, so a malformed answer from one call doesn't sink the other.
- **Cost:** in a live run of 60 extractions the second call fired 12 times (20%), so about 1.2× the token spend on
  gpt-4.1-mini. There were 0 failures, max 2.05 s, p95 1.67 s (unhedged: max 3.62 s, p95 1.84 s). temperature 0
  plus the strict schema make the two calls interchangeable, so taking either answer is safe.
- **Deadline 4 s (was 2.75 s).** 5× eval runs at 2.75 s still had 2 of 150 searches time out: OpenAI has slow
  periods where both calls are slow (raw A/B on another day: p50 1.33 s, p90 1.70 s, max 7.25 s). Raising only the
  deadline costs nothing, and typical searches are unchanged (bench p95 stays well under 3 s). Only the rare search
  where both calls are slow now takes 3–4 s instead of failing. Hedging earlier (1.0 s) would have kept 2.75 s but
  fired the second call on ~90% of searches (~2× cost), and still fails in correlated slow periods.
- **If both calls still miss the deadline → 503** `{ error: { code: "search_unavailable", message: "Search is busy,
  please try again" } }` with `Retry-After: 2`, never a 500. The same applies to an unreachable or garbled model
  (`invalid_output`); a refusal stays 422. The UI shows the message with a Retry button. The search page isn't
  built yet; `ApiError` already carries `status`/`code`, and 503 is not a client error, so React Query retries it.
  503 was added to the contract's status list in CLAUDE.md.
- **A failed LLM call never consumes the free search.** Quota is only taken inside `run_search`, which runs after
  extraction succeeds. `src/app/api/search/route.test.ts` proves it against local Supabase: it stubs the extractor
  to time out or return garbage, then checks for a 503 + `Retry-After`, `searches_used` unchanged, no `searches`
  row, and that the company's one free search still works afterwards.

## Search: extraction cache

- **In-memory LRU of extractions** (`TtlLru` in `src/server/llm/ttl-lru.ts`, used by `extractFiltersCached`).
  500 entries, 1 h TTL. The key is `sha256(normalized brief + model + PROMPT_VERSION)`. The normalized brief is
  `sanitizeBrief(brief).toLowerCase()`, i.e. the text the model sees, minus case. `PROMPT_VERSION` hashes the system
  prompt, few-shots, JSON schema, token cap and seed, so any prompt change invalidates the cache automatically.
- **What it skips:** only the LLM. A repeated brief still counts as a search and still runs `run_search` (quota,
  ranking, snapshot), so results follow the current data. The raw extraction is cached, not the normalized filters,
  so normalizer changes apply immediately. Failures are never cached. Entries are deep-copied on the way in and
  out.
- **Tradeoffs:** the cache is per server process (lost on restart, not shared across instances), which is fine for
  a single-node app and needs no new service. Recruiter-edited `filters` skip the LLM anyway. Briefs are
  lower-cased for the key; casing doesn't change meaning for this vocabulary.
- **Measuring with a cache:** `npm run eval` runs each brief once, so it's unaffected within a run. The stability
  numbers come from restarting the app between runs. `npm run bench` gives every cold brief a unique suffix, so
  "new search" still measures the LLM path, and reports cache hits separately ("cached brief").

## Search: typo rescue, seed, and hostile-input commentary

- **Rescue misspellings the model reported as unsupported** (`rescueTypo` in `normalize.ts`). The model sometimes
  writes "Andriod" into `unsupported` instead of fixing it, which empties the search. Each such item is matched
  against skills, cities, states and roles (incl. aliases) under strict guardrails:
  - 1–2 words, key ≥ 5 characters; distance ≤ 1 (≤ 2 from 9 characters); same first letter; no containment.
  - Exactly one vocabulary value at the best distance across all four kinds, otherwise it stays unsupported.
  - Never an exact vocabulary value: if the model reported "Python" as unsupported it had a reason, e.g. a tenure
    qualifier.
  - Never a word on the `NOT_TYPOS` denylist (below).
- **`NOT_TYPOS` (185 entries)** is generated by `scripts/gen-not-typos.ts`. It runs every word of
  `/usr/share/dict/words` plus ~200 common tech/business terms through the real normalizer and lists each one that
  would be "corrected" ("shift" ≠ Swift, "spare" ≠ Spark, "scale" ≠ Scala, "NestJS" ≠ Next.js). The same guard
  applies to typo matching inside the filter fields. It is deliberately strict: obscure dictionary words such as
  "sattle" or "fronted" also stay unsupported, so those typos give 0 results rather than a guess.
- **Corrections are visible.** Every typo fix is recorded in `filters.corrections` (`{ from, to }[]`) and rendered
  with `formatCorrection` as "Android (corrected from Andriod)". The corrected value is the real filter; corrections
  are informational, like `preferences`.
- **"<X> engineers" precedence also applies to rescued words.** A rescued skill whose "<skill> engineer" is a role
  alias ("Android", "iOS") names that role when the model only gave the generic engineer group. Roles try exact →
  "<skill> engineer" → role typo → skill typo, so "Andriod engineers" is a Mobile Engineer, like "Android
  engineers". Added the aliases "android dev" and "ios dev" next to the existing "mobile/frontend/backend dev".
- **`seed: 20261008`** on the OpenAI call (with temperature 0) reduces run-to-run variance. An interleaved A/B over
  80 calls showed no latency cost (p50 1.33 s with seed vs 1.36 s without).
- **Hostile-input commentary is dropped.** Even with the prompt rule, the model occasionally wrote "SQL injection
  attempt in location field" into `unsupported`, which emptied a legitimate search. The normalizer drops notes that
  comment on the input itself (`INPUT_COMMENTARY`: injection/malicious/… together with attempt/input/detected/…).
  A requirement such as "SQL injection prevention" is kept. An injected-SQL few-shot example was tried first and
  reverted: it fixed that brief but made the model flag stray words ("based") on two others.


## Search UI (`/search`)

- **`/search` is home.** `/` redirects there, login defaults to it, nav links point at it.
- **The current search lives in the URL (`?s=<search_id>`)**, so refresh, Back and shared links work. A new search
  `router.push`es, so each one is a history entry. Page 1 from the POST response seeds the React Query snapshot
  cache, so the URL change renders without a second request.
- **`GET /api/search/{id}` also returns `brief`.** This field is additive (the contract table fixes the POST shape;
  GET has no listed shape). Without it a reloaded `?s=` page could not show the brief or re-run edited filters,
  because `POST /api/search` requires `brief`.
- **Chip edits re-run with `{ brief, filters }` after 300 ms of quiet.** Several toggles in one popover cost one
  search. Each edit is a new search, so on the free plan it hits the 402 and opens the UpgradeDialog, and the chips
  revert. The model's `interpretation` is dropped from edited filters because it describes the original brief.
- **Chip editors keep at least one value.** Unchecking the last value would unmount the chip and close its popover
  mid-edit, so removal is the chip's ×, which comes with Undo.
- **Zero results name a cause without extra queries.** The order is: an `unsupported` term (offer "Search without
  it"), then nothing searchable, then the filter the recruiter just changed (offer to remove it), then otherwise one
  remove-button per filter. Per-filter counts would need N more searches, which would cost quota, so the UI does
  not compute them.
- **Infinite paging calls `fetchNextPage({ cancelRefetch: false })`.** The virtualizer can ask again before
  `isFetchingNextPage` flips, and the default cancels and re-sends the page in flight.
- **Shortlisting from rows** is wired by the shortlists feature (see "Shortlists").

## Candidate profile (`GET /api/people/{id}`, CandidateSheet)

- **A malformed id is a 404, not a 400.** The contract says "404 for unknown/invalid id", and a 404 doesn't hint at
  the id format. Ids must match `^cand_[0-9]+$` (the table's check constraint) before any query runs.
- **The jsonb `experiences` / `education` columns are zod-parsed on the way out**, so a bad row becomes a 500, never
  a malformed payload. The response is `CandidateDetail` (the same shape the UI types use).
- **The open candidate lives in the URL (`?p=<id>`), next to `?s=`.** Opening pushes a history entry, so Back closes
  the sheet. Stepping with ←/→ replaces the entry, so Back still closes instead of walking through every profile.
  Closing pops the entry we pushed, or strips `p` when the page was opened from a link, so it never navigates
  off-site. This uses the native History API, which Next keeps in sync with `useSearchParams` without a server
  round trip. The callbacks read `window.location`, so they are stable and memoized rows don't re-render on open.
  The `selectedId` store field was removed: the URL is the only source of truth.
- **Profiles are cached with `staleTime: Infinity`.** Candidates are seeded and read-only. Hovering or focusing a
  row prefetches the profile and the sheet's `next/dynamic` chunk. While a profile is open, its previous and next
  neighbours are prefetched, so stepping is instant. Within 3 of the loaded end, the next results page loads.
- **The sheet focuses itself on open**, not its first button. Esc and ←/→ work at once, and the stepper tooltip
  doesn't flash. Arrow keys are ignored in inputs and when a modifier is held.
- **Role durations use whole years** (the data has no months): a role that starts and ends in the same year is
  "< 1 yr", and a current role runs to the current year.

## Shortlists (`/api/shortlists/*`, /shortlists)

- **No migration.** The init schema already has `shortlists` (unique `(company_id, lower(name))`), `shortlist_people`
  (PK `(shortlist_id, person_id)`, composite FK to the list *and* its company) and company-scoped RLS. Every route
  uses the caller's RLS client.
- **Another company's list is a 404 on every route**, never a 403 or an empty 200. Member routes first look the list
  up through RLS, so a foreign id fails as "not found" before any insert or delete (an RLS or FK error would
  otherwise leak which ids exist). Malformed ids (not a uuid / not `cand_<digits>`) are also 404, as for people.
- **Names: trimmed, 1–60 characters in the API** (the DB check allows 100 as a backstop) and unique per company
  case-insensitively. A duplicate is a 409 with a sentence the UI shows as is ("You already have a list called …").
  The UI checks the same rules first against the cached lists, so most duplicates never make a round trip.
  An invalid body is a 400, through the shared Zod mapping (same as search).
- **Add is idempotent through `ON CONFLICT DO NOTHING`** (`upsert … ignoreDuplicates`). That needs only the
  insert grant, so members still can't be updated. It returns 201 `{ added: true }` the first time and 200
  `{ added: false }` on a repeat. Remove is idempotent too (204 even when the person wasn't on the list).
- **`GET /api/shortlists` returns `{ shortlists: [...] }`** with each list's `count`, up to 4 `avatar_urls` (most
  recently added first) and every `person_ids`. Member ids let one cached query drive both the filled bookmark on
  every row and the popover checkboxes. Rows then get a plain boolean, so memo holds and there are no per-row
  requests. Lists are small, so the payload stays small. Lists are ordered newest first.
- **Membership changes are optimistic, with Undo.** The bookmark and checkbox flip at once. A refusal rolls back
  from a snapshot and shows an error toast. Success shows "Added to Frontend Q4 · Undo". The callbacks live on the
  mutation, not the component, so Undo still works after a virtualized row or the popover unmounts.
- **Deleting a list asks for confirmation and then offers Undo** (design.md: "deleting a whole shortlist may use
  both"). Undo re-creates the list with the same name and re-adds its members oldest first, so the order is
  kept. The restored list has a **new id**: old links to it 404. This avoids soft-delete columns for a 6-second
  window.
- **Toasts stay clickable over the modal candidate sheet.** Radix sets `pointer-events: none` on `<body>`.
  `[data-sonner-toaster]` opts back in, and the sheet ignores outside interactions that land on the toaster.
- **The shortlist menu is a Popover from 768px up and a nested Drawer below.** Its body (search, checkboxes,
  "New list…") is a `next/dynamic` chunk that loads on open or on trigger hover. Search-as-you-type filters the
  cached lists locally (cmdk), so there is no network call to debounce.
- **The app frame's active-nav state sits behind Suspense.** `usePathname()` on a dynamic route (/shortlists/[id])
  is runtime data under cacheComponents. Its links prerender un-highlighted and the active state streams in.
- **`probe:security` now judges non-JSON responses.** Only Next's HTML 404 ("route not built yet") counts as a skip.
  Before this, a 204 from a successful cross-tenant DELETE would have been skipped instead of failed.

## Saved searches (`/api/saved-briefs/*`, /saved)

- **`POST /api/saved-briefs` validates `filters` with the same `filtersSchema` as recruiter-edited search
  filters** (every value from the data vocabulary, strict keys), so a saved search can always be re-run. It returns
  201 `{ id }`. `GET` returns `{ saved_briefs: [{ id, brief, filters, created_at }] }`, newest first. Stored filters
  are re-parsed on read and fall back to `{}`, so a later vocabulary change can't hand the UI unknown values.
- **Saved searches are company-wide**, like shortlists. Every recruiter at the company sees and can delete them
  (RLS on `company_id`). A malformed id, another company's row and a deleted row all return 404.
- **"Save search" saves the brief the results are for plus the filters as currently edited**, not text typed
  in the bar but not yet run. The button reads "Saved" when that exact brief + filters already exists, compared
  with a key-order-insensitive key (jsonb reorders keys). This stops duplicate saves without a unique constraint.
- **Run = `POST /api/search { brief, filters }`**. It's a new search and counts against the free plan. When the
  cached plan says 0 free searches left, the UpgradeDialog opens without calling the API. A 402 from a race does
  the same. In the sidebar, clicking a saved search runs it, because that's the only reason to click it.
- **Delete is optimistic with Undo, no confirmation.** It's cheap to recreate. Undo saves the same brief + filters
  again, so the restored row has a new id and saved date, and moves to the top. Recruiters can only write `brief`
  and `filters`, and soft-delete isn't worth adding for a 6-second window.

## Billing (`POST /api/billing/events`, `apply_stripe_event`, plan UX)

- **One DB function applies an event atomically.** `private.apply_stripe_event(event jsonb)` (security definer,
  `search_path = ''`) inserts the event id into `stripe_events` `ON CONFLICT DO NOTHING` (no row → `duplicate`),
  then upserts the subscription under a row lock (`select … for update`, with an insert race fallback). It returns
  `applied | duplicate | ignored | stale`, which the route echoes as `{ received: true, result }` with 200.
- **Service-role only, enforced twice.** `EXECUTE` is granted only to `service_role` on the private function and
  on its `public.apply_stripe_event` wrapper. The wrapper is needed because PostgREST doesn't expose `private`.
  There is no recruiter, so instead of the usual `auth.uid()` check the function requires
  `auth.role() = 'service_role'`. `probe:security` checks that recruiter, anon and direct `private` calls are
  denied and leave no rows.
- **Every verified event is recorded, even ignored ones.** A redelivery of an ignored event is then a cheap
  `duplicate`.
- **What is applied:** only `customer.subscription.*`, the only subscription-bearing types in the sample. Other
  types → `ignored`. Company = `companies.slug = data.object.metadata.company`; unknown or missing → `ignored`.
  A status outside the table's check list → `ignored`. `customer.subscription.deleted` always stores `canceled`,
  whatever `data.object.status` says. A subscription id never moves to another company (→ `stale`).
- **Ordering uses `event.created`, never arrival order or the signature `t`** (data-notes §5). An event applies
  only if `created > last_event_created`. **Tie on `created`:** `canceled` wins; otherwise the larger event id
  (`collate "C"`) wins. Stripe's second-resolution timestamps make ties realistic, and a deterministic rule keeps
  replays order-independent. Preferring cancel errs toward "not paid", the safer side.
- **`canceled` is terminal per subscription id.** Stripe can't reactivate a canceled subscription; resubscribing
  creates a new id, which is a new row. A later event for a canceled id is `stale`.
- **`past_due`, `unpaid`, `incomplete`, `incomplete_expired`, `paused` are stored as-is and count as free.** This
  is a strict reading of "paid iff active or trialing", with no grace period. A later `active` event (newer
  `created`) restores paid. A real product might give `past_due` a dunning grace window; that's out of scope here.
- **Signature:** `src/server/billing/verify-signature.ts` parses `t=` (exactly one) and one or more `v1=` (64 hex
  chars; other schemes such as `v0` are skipped). It computes HMAC-SHA256 of `${t}.${rawBody}` and compares every
  candidate with `timingSafeEqual`, without exiting early. **No timestamp tolerance**, because the sample events
  are historic. The tradeoff is that a captured request can be replayed, but replays dedupe on event id, so a
  replay can only repeat an outcome that already happened.
- **The route reads `await req.text()` and verifies before parsing.** Bad or missing signature → 400. A signed
  body that isn't JSON, or lacks `id`/`type`/`created` → 400. A missing secret → 500, logged by name only. Logs
  include the event id, type and result, never the payload or the secret. No `runtime` export, because Next 16
  rejects it with cacheComponents; the default runtime is Node, which `node:crypto` needs. `proxy.ts` already
  skips this path.
- **`replay:stripe` resets the billing tables** and replays the file in order with the exact bodies. It sends the
  file's own `Stripe-Signature` headers when they verify with the configured secret. Otherwise it re-signs each
  exact payload with the local secret at the same `t`, and says so. It asserts each step from data-notes §5 and
  `expected_plans_after`, then runs generated scenarios (bad signatures, replay, reversed pair,
  cancel-then-resubscribe, out-of-order cancel, ties). It finishes by resetting and replaying the file again, so
  the DB ends in the documented state. Don't run it concurrently with `eval`/`test:quota`, whose fixture
  subscriptions the reset would remove.
- **Plan UX:** PlanBadge reads "Free · 1 search left", "Free · 0 left" or "Pro". `SearchQuota` shows the free
  quota in the search status row from `sm` up. Below `sm`, the top-bar badge sits directly above the search bar,
  so it isn't repeated. The UpgradeDialog says Pro = an active Stripe subscription for your company, with no
  checkout. `useRunSearch` already invalidates `["plan"]` on settle, and saved-search re-runs go through it.

## Security pass (headers, rate limit, hostile input, probes)

- **Security headers live in `next.config.ts` `headers()`**, on every path: CSP, `X-Content-Type-Options: nosniff`,
  `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY` (old browsers; CSP
  `frame-ancestors 'none'` is the real control), `Permissions-Policy` (no camera/mic/geolocation), and
  `poweredByHeader: false`.
- **CSP:** `default-src 'self'`; `connect-src` adds only the Supabase origin (the browser calls it only for
  sign-in/out); `img-src` adds `https://rotto.com` **and** `https://www.rotto.com`. The data's avatar/logo URLs are
  SVGs on rotto.com, which `next/image` passes through unoptimized, and rotto.com redirects to www. The browser
  follows the redirect and CSP checks the final URL (found in a browser check: every image was blocked without
  www). `frame-ancestors 'none'`, `base-uri 'self'`, `form-action 'self'`, `object-src 'none'`. Dev adds
  `'unsafe-eval'` (React dev tooling) and `ws:` (HMR) only.
- **`script-src 'self' 'unsafe-inline'`, no nonce: a deliberate tradeoff.** A nonce must differ per response, so
  every page would render per request, which throws away `cacheComponents`' prerendered static shells. Next's RSC
  payload and next-themes' anti-flash script are inline scripts. What we rely on instead: React escapes all
  rendered data, there is no `dangerouslySetInnerHTML` with data, scripts load only from `'self'`, and objects,
  base-URI tricks, form exfiltration and framing are all closed.
- **Rate limit: `POST /api/search`, per recruiter (`userId`), in memory** (`src/server/rate-limit.ts`): a token
  bucket of 30 that refills at 1/s. That's far above human use, keeps `test:quota`'s 25 concurrent requests
  intact, and caps how fast one account can burn LLM spend. It runs first in `runSearch`, before the plan read,
  the LLM and `run_search`, so a 429 (`rate_limited`, `Retry-After` = seconds until a token) consumes nothing.
  Per process, so N instances allow N×; a shared store (Redis/Postgres) would be needed for that, and the free
  quota is enforced in SQL regardless. `scripts/lib/api.ts` waits out a 429 (up to 3 retries), so `eval`/`bench`
  never fail on it. Tests reset the limiter between cases.
- **Free text must be storable:** briefs and free-text filter strings (`unsupported`, `preferences`, `corrections`,
  `interpretation`) reject C0 control characters (tab/LF/CR allowed), DEL and lone UTF-16 surrogates → 400. Before
  this, a NUL reached Postgres (`22P05`) and a lone surrogate reached PostgREST as invalid JSON (`PGRST102`): both
  were 500s. The schema is shared, so saved briefs are covered too.
- **`run_search` refuses a match set of everyone** (migration `run_search_guards`): when the matched count equals
  the candidate count it raises `PT422`, so nothing is stored and no quota is consumed, and the API answers 422
  "These filters match every candidate…". "Never return everyone" is now enforced on the result, not only on the
  input. That covers any constraint that narrows nothing: `years_experience: {max: 15}` (the data's maximum)
  passed the schema and returned all 5,000, and a direct RPC with `min: -100` did too. It also rejects years
  outside 0–50 or min > max (`22023`), matching the API schema for direct RPC callers.
- **Hostile suite (`src/app/api/search/hostile.test.ts`):** the LLM is stubbed as a worst case, a model that obeys
  the brief and echoes attacker text into every field. Covers SQL/prompt-injection briefs, 10k/1 MB bodies, emoji,
  zero-width, NUL, control, RTL and lone-surrogate input, every malformed filters shape, hostile paging params and
  cross-tenant paging. Every response must be 4xx or a bounded 200, with no stack/SQL text. The attacker is a
  throwaway company + recruiter created and deleted by the test, because the suites run in parallel and acme's and
  globex's plans/counters belong to `route.test.ts` and `plan/route.test.ts`. Row counts of tables no other suite
  writes are compared before/after; searches must equal the number of 200s.
- **`probe:security` coverage:**
  - Every table × select/insert/update/delete with only the publishable key, plus raw PostgREST `fetch`es.
  - `run_search` called directly: the quota holds (PT402, nothing consumed); vacuous, malformed or off-vocabulary
    filters are refused or return 0; a smuggled `company_id` is ignored.
  - `search_page`/`apply_stripe_event`/private functions: each must be refused with a specific code, not just
    return 0 rows.
  - Attempts to move a row to the other company on every writable table, and globex deletes by
    `person_id`/`company_id`.
  - Every API route × {no token, publishable key as Bearer, junk JWT, Basic, a real user with no recruiter row}
    → 401 JSON without internals.
  - Before/after row counts of all 9 tables.
  - A malformed person id is a 404 by design (indistinguishable from unknown), not a 400.
- **Independent review (security-reviewer agent):** no Critical/High. Fixed:
  - The rate limit now runs *after* the 402 pre-check, so an exhausted free plan always answers 402 (the
    contract), never 429.
  - The post-login `?next=` is resolved with `new URL()` and must keep the same origin
    (`src/features/auth/safe-next.ts`). The old regex let `/\t/evil.example` through, because URL parsing strips
    the tab.
  - The webhook caps `created` at 15 digits, so an over-long value is a 400, not a 500 that Stripe would retry.

  Fixed in a follow-up (migration `run_search_limits_shortlist_key`):
  - (Medium) **`run_search` enforces the API schema's limits itself**, because recruiters can call it directly
    through PostgREST: filters ≤ 32 KB, only known top-level keys, lists ≤ 20 items, notes ≤ 10, every string
    ≤ 300 chars → `22023`. Before, 1,500 `preferences` ran scoring into the 8 s statement timeout on every call (rolled
    back, so free to repeat), and a 2 MB `p_filters` was stored verbatim. Both are now refused in < 0.1 s. A
    worst-case valid search (all 13 roles, 20 skills, 10 long preferences) takes ~0.15 s. The API can't hit these
    limits: `normalizeFilters` ends in `filtersSchema.parse`.
  - (Low) **`shortlist_people` key is `(shortlist_id, company_id, person_id)`.** With `(shortlist_id, person_id)`,
    an upsert with ignore-duplicates into another company's list matched that company's row before the foreign
    key was checked: 201 for a member, 409 for a non-member. `company_id` always defaults to the caller's company,
    so another company's row can't be the conflict target, and member and non-member get the same answer.
    Uniqueness is unchanged in practice (a shortlist has exactly one company); `addPerson` uses the new conflict
    target. Both are covered by `probe:security`.

  Still open:
  - (Info) Briefs written directly to the DB bypass the control-character check.

## Redesign: LLM-tool look (design system only)

- **Plus Jakarta Sans replaces Geist Sans; Geist Mono stays for ranks.** The references use a geometric sans
  with a large x-height, round bowls and regular-weight display text. Jakarta matches that, is self-hosted
  through `next/font`, ships tabular figures, and stays crisp at 13–14 px. Inter Tight and Figtree with
  Instrument Serif were the alternatives; the user chose Jakarta.
- **Warm stone neutrals with forest green, instead of cool grey with cobalt.** The references sit on a warm
  off-white page with white cards and deep green for the active state. Green also reads as "match" for matched
  skills. `--success` and `--primary` are both green, but they never appear on the same element type
  (success = the "Open to work" pill; primary = actions, focus, selection).
- **The gradient is a token (`--accent-gradient`) used in four places only:** the composer focus border, the
  send button, the active thinking dot and the upgrade mark. A gradient everywhere stops meaning "AI is here".
- **ThinkingSteps are timer-driven, not real progress.** `POST /api/search` is one request (LLM extraction,
  then SQL) with no streaming. The steps advance at 0 / 0.7 / 1.5 / 2.3 s and the last one holds until the
  response lands, so the UI never claims to be done early. Edited-filter runs skip the model, so they start at
  "Finding people". Streaming real stages would change the API contract, which is out of scope.
- **No match-% rings, although the references have them.** Ranking is a deterministic SQL score, not a
  similarity percentage. Showing "72% match" would invent precision we don't have and imply the model judged
  the candidate, which it never does.
- **`CandidateCard` is the new result component; `CandidateRow` is its `row` appearance.** Existing pages
  (shortlist detail, the virtualised result list) keep their imports and their hairline-divided
  `CandidateList`. `SearchBar` is now a thin wrapper over the docked `Composer`.
- **The dark variant is `&:where(.dark *, .theme-dark, .theme-dark *):not(:where(.theme-light, .theme-light *))`.**
  This lets `/dev/design` render light and dark panes side by side (`.theme-light` / `.theme-dark` re-declare
  the role tokens). The app itself still toggles `.dark` on `<html>` through next-themes. Overlays portal to
  `<body>`, so they follow the global theme.
- **The 375 px review uses iframes of `/dev/design?frame=1&theme=…`.** Breakpoints are viewport media
  queries, so only a real 375 px viewport shows the true mobile layout (tab bar, drawers, stacked rows).
- **The inline shortlist-menu preview on `/dev/design` is static markup.** A mounted cmdk list calls
  `scrollIntoView` on its auto-selected item, which scrolled the page to that section on load. The interactive
  copy lives in the popover, which only mounts when opened.
- **The card shortlist button is always visible, with a "Shortlist" label from `sm` up.** It used to be revealed
  on hover for fine pointers; applying the design to the real results page showed that hid the main action on a
  result. Below `sm` it is a 44px round bookmark (the label would cost a third of the card's text width at 375px);
  its `aria-label` always names the person, and the candidate sheet's sticky bottom bar has the labelled button.

### Applying the design to the real screens

- **Search results are standalone cards (`CandidateCard`), still window-virtualised.** Each card's wrapper
  carries the 8px gap (`pb-2`) so measured heights include it. Shortlist pages keep the flat hairline rows: they
  are a dense list you manage, not an answer you read.
- **The docked composer and the understood filters share one sticky header.** "Understood filters always
  visible" means visible while scrolling 600 results, not just at the top. On mobile the chips are one
  horizontally scrolling row so the header stays under ≈ 200px below the top bar, even with a two-line brief.
- **The card entrance plays once per new brief.** A search id is marked "intro" when a brief's results land and
  unmarked after 1.5 s, so the cards and chips don't re-animate on edits, reloads, back/forward or when the
  virtualiser remounts a card while scrolling.
- **"Clear all" starts over instead of removing every filter.** Removing every constraint can only produce the
  "nothing to search for" empty state (we never return everyone) and would spend a search. Clearing returns to
  the hero composer, which runs nothing.
- **The 402 path still goes through the API.** The client could skip the request when the cached plan says 0
  left, but the plan can flip to paid at any moment via the webhook, so the server's cheap pre-check (no LLM
  call) stays the source of truth. A 402 opens the UpgradeDialog; the brief stays in the composer.
- **Search error copy is chosen by status, not the server message.** 503 and 429 say plainly that nothing was
  used from the plan (that is the API contract); offline and anything else get their own sentence.
- **The login page shows a still product glimpse from `lg` up** (`LoginPreview`): no names, avatars or numbers
  that look like real data beyond one example count, and no animation, so it can't be mistaken for live results.
