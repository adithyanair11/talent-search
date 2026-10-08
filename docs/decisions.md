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
- **Unimplemented scripts** (`replay:stripe`, `test:quota`, `bench`) are stubs
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

