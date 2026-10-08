---
name: search-tune
description: Measure and improve natural-language search accuracy (filter extraction prompt, schema, vocabulary normalization, SQL matching and ranking) against data/queries.json without overfitting. Use whenever search quality, the LLM prompt, filter schema or ranking SQL changes.
---

Search tuning task:

$ARGUMENTS

1. Run `npm run eval` first and record the baseline: per-query precision, recall, F1, page-1 precision,
   plus overall macro averages and LLM latency.
2. For every query below F1 = 1.0, diagnose WHERE it fails before changing anything:
   - extraction: print the filters the LLM produced vs what the brief means
   - normalization: a value that didn't map to the data vocabulary (see `docs/data-notes.md`)
   - matching: SQL too strict (missed people) or too loose (wrong people)
   - ranking: right people present but not on page 1
   Write the diagnosis as a short table before editing.
3. Fix the general cause, never the specific query:
   - NEVER put a brief's text, candidate ids or names from queries.json into prompts, code or SQL.
   - Prefer data-driven fixes (synonym maps built from the real vocabulary, seniority→years rules,
     title families) documented in `docs/data-notes.md`.
   - Prompt examples must be invented briefs, not the eval ones.
4. Precision rules (the grader rewards "nothing" over "wrong people"):
   - every filter the brief states is a hard constraint unless it is explicitly a preference ("ideally", "nice to have")
   - a requirement the data cannot express → put it in `unsupported`; if it is material to who
     qualifies, return 0 results with an explanation; never silently drop it and widen the result set
   - vague briefs with no supportable constraint → 0 results, not everyone
5. Re-run `npm run eval` after each change. Keep a change only if the macro F1 does not drop and no query
   regresses by more than a little without a stated reason. Also run 5–10 new briefs you write yourself
   (paraphrases, typos, mixed constraints, hostile text) to check generalization.
6. Confirm a new search still completes in < 3 s and paging in < 300 ms (`npm run bench`).
7. Record what changed and why in `docs/decisions.md` (search section). Report before/after numbers.
   Do not commit.
