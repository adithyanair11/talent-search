# Decisions

Non-obvious choices, newest last. Feeds the README.

## Scaffold

- **Supabase CLI pinned as a devDependency (`supabase@2.119.0`) and always run via `npx supabase`.**
  No global install, so a fresh clone gets the exact CLI version from `npm ci`.
- **`supabase/config.toml` `project_id = "talent-search"` set explicitly.** `supabase init` derives it from the
  folder name, which produced `talent-search_` here (the checkout folder ends with a space). An explicit id keeps
  Docker container/volume names stable regardless of where the repo is cloned.
- **Auth:** email/password only; `enable_signup = false` (global and email) since sign-up is out of scope;
  recruiters are created by `scripts/seed.ts` via the admin API. Email confirmations off. `site_url` is
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
- **Unimplemented scripts** (`eval`, `replay:stripe`, `probe:security`, `test:quota`, `bench`, `seed`) are stubs
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
