# Talent Search

A recruiter types a plain-English brief ("senior React engineers in New York who have worked at a startup"). An
LLM turns it into structured filters, and Postgres finds and ranks the matching candidates from 5,000 profiles.
Recruiters can shortlist people into named lists and save searches. Two companies (acme, globex) are fully
isolated by row-level security. The free plan allows one search; the paid plan is set only by Stripe webhook events.
Stack: Next.js 16, Supabase (local), OpenAI, TanStack Query, shadcn/ui.

## Run it

Needs Node 24 and Docker running. `OPENAI_API_KEY` is required. `STRIPE_WEBHOOK_SECRET` is optional: setup
generates a local one if it isn't set. Real environment variables always win over `.env.local`.

```sh
make setup   # npm ci, start Supabase, migrate, write .env.local, seed recruiters + candidates
make dev     # http://localhost:3000
```

Demo logins (password `rotto-assessment`, also shown on the login page): `recruiter@acme.test`,
`recruiter@globex.test`. Both companies start on the free plan with no billing state.
To try the paid plan locally: make demo-paid. (`make reset-quota` gives both companies their free search back.)
Checks: `npm run eval | test:quota | replay:stripe | probe:security | bench` (each needs `make dev` running).

## How search works

```
brief ─► sanitize (strip control chars, cap 500, neutralize <brief> delimiters)
      ─► OpenAI gpt-4.1-mini, strict JSON schema, temp 0 (hedged 2nd call at 1.4 s, 4 s deadline, 1 h cache)
      ─► zod validate ─► normalize every value against the real data vocabulary (unknown → unsupported)
      ─► public.run_search(): one transaction: lock quota row, match + deterministic SQL score, store id snapshot
      ─► page 1 returned; later pages read the stored snapshot (no LLM, no re-rank)
```

**How we stop the LLM inventing filters**

- **Strict schema:** the model can only emit the extraction schema (structured outputs, `strict: true`). Its output
  is data, never executed as SQL or instructions. `run_search` is static SQL with typed parameters.
- **Vocabulary normalization:** the model emits free strings, not enums, so it can't force "C++" into the nearest
  valid skill. A deterministic normalizer maps each value to a real skill, city, role or school (with aliases and
  guarded typo correction). Every value either maps or becomes an `unsupported` note; nothing is dropped silently.
- **Unsupported → zero results:** a material requirement the data can't express ("speaks Japanese"), or no real
  constraint at all, returns 0 results plus an explanation. `run_search` also refuses any filter set that matches
  everyone. Returning nothing beats returning the wrong people.
- **No candidate data is sent to the model.** It never chooses or ranks people. Ranking is a deterministic SQL score
  with ties broken by id.
- **The brief is treated as data:** it is sent only as the delimited user message. The system prompt says to
  ignore instructions inside it. Recruiter-edited filters skip the LLM and go through the same validation.

**Eval** (`npm run eval`, through the real API): the 10 public briefs score macro P 1.000 / R 1.000 / F1 1.000.
The 15 extra briefs (vague, unanswerable, typo'd, hostile; `scripts/eval-extra.json`) also score 1.000. A
held-out set never used for tuning scored F1 0.875. Bench p95: new search 1.67 s, paging 9 ms.

## Model and cost

**gpt-4.1-mini.** Extraction is short, structured and vocabulary-bound. It doesn't need a reasoning model, and
latency matters (p50 ≈ 1.3 s). Mini supports strict structured outputs and `seed`, and got 1.000 on the eval.
Override it with `OPENAI_MODEL`.

**Cost per search ≈ $0.0006.** Measured over 30 eval briefs: an average of 2,406 input tokens per call (2,103 of
them hit OpenAI's prompt cache, since the system prompt and vocabulary are a fixed prefix) and 86 output tokens.
OpenAI standard pricing for gpt-4.1-mini, checked 2026-10-08 at developers.openai.com/api/docs/pricing: $0.40 /
1M input, $0.10 / 1M cached input, $1.60 / 1M output.
302 × $0.40 + 2,103 × $0.10 + 86 × $1.60 per 1M tokens = **$0.00047 per call**. The hedged second call fires on
about 20% of searches, giving ×1.2 ≈ **$0.00056**, or about $0.56 per 1,000 searches. With a cold prompt cache
it is ≈ $0.0011. Repeated briefs within an hour, edited filters and paging cost $0.

## Tradeoffs (details in `docs/decisions.md`)

- **Snapshot paging vs live results:** each search stores its ranked id list, so pages are stable (every result
  appears exactly once) and fast. The cost is that a snapshot doesn't reflect later data changes until you search again.
- **Hard filters vs recall:** every constraint is an exact filter on the data's vocabulary. Precision is high, but
  near-misses are excluded ("senior" excludes staff, and "React" never matches "React Native"). Preferences only boost
  ranking.
- **No timestamp tolerance on webhooks:** the sample events are historic. A captured request could be replayed,
  but events dedupe on id and apply only if newer than the stored event (`canceled` is terminal), so a replay can't change the outcome.
- **In-memory rate limit and LLM cache:** these are per process, so N instances allow N times the burst. The free
  quota itself is enforced in SQL under a row lock, so it holds regardless.
- **Strict plan reading:** `past_due` and similar statuses count as free, with no dunning grace period.
- **CSP allows `'unsafe-inline'` scripts with no nonce**, to keep prerendered static shells. React escaping and
  `script-src 'self'` are the controls we rely on instead.

## With another week

- Soft constraints with a recall fallback (for example "senior" → also show staff, ranked lower), and
  "only ever worked at startups" (`scope: all`).
- Stream the real pipeline stages to the UI instead of timer-driven "thinking" steps.
- A shared Redis/Postgres rate limiter and extraction cache for multi-instance deploys.
- Log token usage per search, and a larger held-out eval set from real recruiter briefs.
- Webhook timestamp tolerance once events are live, and a nonce-based CSP.
