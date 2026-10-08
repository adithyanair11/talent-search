---
name: verify-feature
description: Run the full pre-commit verification for the feature just built — typecheck, lint, tests, the relevant scripts, a secrets scan and a scope check — and report a commit-ready summary with a suggested commit message. Use at the end of every feature, before the user commits.
---

Verify the feature just completed:

$ARGUMENTS

1. `git status` and `git diff --stat`: list every changed file. Flag anything outside the feature's scope.
2. Run and show results of: `npm run typecheck`, `npm run lint`, `npm test`.
3. Run whichever apply: `npm run eval` (search), `npm run replay:stripe` (billing),
   `npm run probe:security` (any DB/API change), `npm run test:quota` (search/plan),
   `npm run bench` (search/paging), `npm run build` (UI or config changes).
4. Secrets scan:
   - grep `src/` and `.next/static` (after build) for `service_role`, `sb_secret_`, `sk-`, `whsec_`,
     `OPENAI_API_KEY`, `SUPABASE_SECRET`, `SERVICE_ROLE` — must be zero hits in client code/bundles
   - every file importing the admin client or OpenAI starts with `import 'server-only'`
   - no new `NEXT_PUBLIC_*` variable other than the Supabase URL and publishable/anon key
5. Contract check: if an API route changed, confirm its response shape still matches CLAUDE.md.
6. Check `docs/decisions.md` was updated for any non-obvious choice.
7. Output:
   - PASS/FAIL table for each check
   - anything the user should verify by eye
   - a suggested conventional commit message (`feat(scope): ...`)
   Do NOT run `git add`, `git commit` or `git push`.
