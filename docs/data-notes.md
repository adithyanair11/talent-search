# Data notes

Evidence-based description of the vendored data in `data/`. It drives the filter schema, the LLM prompt,
vocabulary normalization, the ranking SQL and the billing webhook. Every number below was produced by
throwaway Node scripts run over `data/*.json` (deleted afterwards); none of it is guessed.

The data is synthetic and very regular. That is good news: almost every recruiter concept maps onto one exact
field with a closed vocabulary, so the search can be precise. The catch is the reverse: a concept that is **not**
in this vocabulary cannot be answered and must become `unsupported` rather than be approximated.

---

## 1. Candidate JSON shape

`data/candidates.json` is an array of **5000** candidates. `id` runs `cand_0001` … `cand_5000`, all unique.
Every candidate has exactly the same set of keys. **Nothing is null or missing** except
`experiences[].end_year` (see below).

| Field | Type | Notes |
|---|---|---|
| `id` | string | `cand_NNNN`, zero-padded, unique |
| `full_name` | string | Display only. Never use for search (no inferring gender/ethnicity from names). |
| `avatar_url` | string | `https://rotto.com/rotto/full-stack-assessment/avatars/avatar-NNN.svg` |
| `headline` | string | Always `"{current_title} · {skills[0]}, {skills[1]}, {skills[2]}"` (5000/5000) — derived, no extra info |
| `current_title` | string | Always `"{Staff \| Senior \| Junior \| (none)} {role}"`; prefix is exactly `seniority` (`mid` = no prefix) (5000/5000) |
| `current_company` | string | Always `experiences[0].company` |
| `current_company_logo_url` | string | Always `experiences[0].company_logo_url` |
| `role` | string | 13-value enum (see §2) |
| `seniority` | string | `junior` \| `mid` \| `senior` \| `staff` |
| `years_experience` | integer | 0–15 |
| `location` | object | `{ city: string, state: string, country: string }`, all non-null |
| `open_to_work` | boolean | |
| `skills` | string[] | 3–6 items, no duplicates, canonical casing |
| `experiences` | object[] | 1–4 items, newest first |
| `education` | object[] | **always exactly 1** item |

`experiences[]` (9620 rows):

| Field | Type | Notes |
|---|---|---|
| `title` | string | Same shape as `current_title`. **Every past title has the candidate's current `role`** (9620/9620) — only the level prefix changes (e.g. "Junior DevOps Engineer" → "DevOps Engineer"). No career changes exist in the data. |
| `company` | string | 28-value vocabulary |
| `company_logo_url` | string | |
| `company_type` | string | `startup` \| `enterprise`; fixed per company |
| `start_year` | integer | 2011–2026 |
| `end_year` | integer \| **null** | `null` on exactly one row per candidate — always `experiences[0]`, the current job (5000/5000) |
| `description` | string | Always `"{title} at {company}, working mostly with {s1} and {s2}."` where s1, s2 ∈ `skills` (9620/9620) — carries no information beyond other fields |

`education[]` (5000 rows, one per candidate): `school` string, `degree` string, `field` string,
`graduation_year` integer (2010–2026).

Distributions: experiences per candidate 1: 2313, 2: 1291, 3: 859, 4: 537. Skills per candidate
3: 1233, 4: 1228, 5: 1346, 6: 1193.

**`years_experience` is its own field, not derivable from the timeline.** It equals `2026 − earliest start_year`
for only 1811 candidates; for the rest it is 1–14 years higher (pre-history not listed). Always use the field.

**Consequence for storage:** `current_title`, `headline`, `current_company*` and `description` are derivable;
search should filter on `role`, `seniority`, `years_experience`, `location`, `open_to_work`, `skills`,
`experiences.company / company_type` and `education.*`. Free-text matching over headline/description adds
nothing and only risks false positives (e.g. "React" matching "React Native").

---

## 2. Vocabulary (with counts)

### Locations — 10 values, all US

| city | state | country | count |
|---|---|---|---|
| New York | NY | US | 1099 |
| San Francisco | CA | US | 890 |
| Los Angeles | CA | US | 485 |
| Seattle | WA | US | 423 |
| Chicago | IL | US | 397 |
| Austin | TX | US | 395 |
| Boston | MA | US | 387 |
| Denver | CO | US | 324 |
| Atlanta | GA | US | 321 |
| Miami | FL | US | 279 |

- One spelling per city (no "NYC", "SF", "New York City" variants). State is a 2-letter code. Country is always `US`.
- City → state is 1:1 except **CA = San Francisco + Los Angeles**. So "in California" (state) ≠ "in San Francisco".
- No suburbs or metros exist (no Oakland, Brooklyn, Cambridge…). "Bay Area" can only mean San Francisco;
  "NYC"/"Manhattan" only New York. Any other city/country is not in the data.

### Roles — 13 values (`role`)

Frontend Engineer 593 · Full Stack Engineer 586 · Backend Engineer 573 · Product Designer 414 ·
Product Manager 411 · Data Engineer 330 · Data Scientist 323 · Machine Learning Engineer 323 ·
Mobile Engineer 320 · Account Executive 317 · DevOps Engineer 281 · Marketing Manager 274 · Recruiter 255

### Seniority — 4 values, with disjoint years bands

| seniority | count | title prefix | years_experience range |
|---|---|---|---|
| junior | 941 | `Junior ` | 0–2 |
| mid | 921 | (none) | 3–5 |
| senior | 1254 | `Senior ` | 6–9 |
| staff | 1884 | `Staff ` | 10–15 |

No `Lead`, `Principal`, `Head`, `Director`, `Intern` or `Manager`-as-level titles exist anywhere (current or past).
Because the bands are disjoint, `seniority = senior` and `years_experience BETWEEN 6 AND 9` select the same
people — but "senior" is a level word, so filter on `seniority` (see §3, query 1).

### years_experience distribution (0–15, roughly uniform)

0: 324 · 1: 317 · 2: 300 · 3: 317 · 4: 305 · 5: 299 · 6: 320 · 7: 315 · 8: 289 · 9: 330 ·
10: 355 · 11: 273 · 12: 293 · 13: 317 · 14: 324 · 15: 322

### open_to_work

true 1510 · false 3490

### Skills — 79 values, canonical casing, no variants

A case/punctuation-insensitive collision check found **zero** variants (no "react" vs "React", no "NodeJS"
vs "Node.js"). Matching must be exact against these canonical strings after normalization.

| Skill | n | Skill | n | Skill | n | Skill | n |
|---|---|---|---|---|---|---|---|
| Python | 1051 | Svelte | 282 | Greenhouse | 220 | Pandas | 195 |
| SQL | 835 | Accessibility | 276 | Flutter | 219 | TensorFlow | 194 |
| AWS | 815 | Ruby on Rails | 270 | Employer Branding | 219 | iOS | 193 |
| TypeScript | 739 | Jira | 259 | Sourcing | 218 | LLMs | 192 |
| Next.js | 556 | Roadmapping | 258 | Technical Recruiting | 214 | R | 191 |
| User Research | 550 | JavaScript | 256 | Interviewing | 213 | MLOps | 185 |
| React | 541 | CSS | 254 | Kotlin | 210 | PyTorch | 176 |
| Tailwind | 526 | Pricing | 253 | Brand | 210 | CUDA | 175 |
| Kubernetes | 517 | Analytics | 249 | HubSpot | 206 | Scala | 172 |
| GraphQL | 514 | Negotiation | 249 | Android | 205 | Airflow | 172 |
| Postgres | 504 | Java | 245 | Lifecycle Marketing | 204 | Statistics | 169 |
| Node.js | 488 | Salesforce | 243 | Content Marketing | 200 | Snowflake | 166 |
| A/B Testing | 432 | Outbound | 233 | Swift | 199 | CI/CD | 164 |
| Kafka | 424 | Enterprise Sales | 232 | SEO | 198 | Tableau | 162 |
| Design Systems | 320 | SaaS | 232 | Paid Social | 198 | Spark | 160 |
| Webflow | 319 | Redis | 231 | Machine Learning | 196 | dbt | 155 |
| Vue | 315 | Go | 230 | | | Datadog | 146 |
| Prototyping | 314 | Pipeline Management | 230 | | | GCP | 146 |
| Figma | 303 | Rust | 229 | | | Linux | 145 |
| Interaction Design | 297 | gRPC | 224 | | | Docker | 139 |
| | | React Native | 220 | | | Ansible | 131 |
| | | | | | | Terraform | 127 |

Pitfalls for matching:
- **"React" ≠ "React Native"** (substring match would wrongly add 6 mobile engineers to query 1).
- **"Go"**, **"R"** are short words — only match as whole canonical skill values, never substrings.
- **"Machine Learning"** is a *skill* (Data Scientists only); **"Machine Learning Engineer"** is a *role*.
- **"Enterprise Sales"** is a *skill* (Account Executives only), unrelated to `company_type = enterprise`.
- No synonyms are stored: "Golang", "k8s", "Postgres(QL)", "JS", "TS", "Rails", "GA4", etc. must be mapped to
  canonical names by the normalizer or rejected.

Skills are role-specific — each skill appears only for these roles:

| Roles | Skills |
|---|---|
| Frontend Engineer | Vue, Accessibility, Svelte, CSS, JavaScript |
| Frontend / Full Stack | GraphQL, Next.js, React, Tailwind |
| Frontend / Full Stack / Mobile | TypeScript |
| Full Stack Engineer | Ruby on Rails |
| Backend / Full Stack | Node.js, Postgres |
| Backend Engineer | Go, Java, Redis, Rust, gRPC |
| Backend / Data Engineer | Kafka |
| Backend / Data Eng / DevOps / Full Stack | AWS |
| Backend / DevOps / ML Engineer | Kubernetes |
| Backend / Data Eng / Data Sci / Full Stack / ML Eng | Python |
| Mobile Engineer | Flutter, Kotlin, React Native, Android, Swift, iOS |
| DevOps Engineer | Ansible, CI/CD, Datadog, Docker, GCP, Terraform, Linux |
| Data Engineer | Snowflake, Spark, dbt, Scala, Airflow |
| Data Engineer / Data Sci / ML Eng / Product Manager | SQL |
| Data Scientist | Machine Learning, Pandas, R, Statistics, Tableau |
| Data Scientist / Product Manager | A/B Testing |
| Machine Learning Engineer | CUDA, LLMs, MLOps, TensorFlow, PyTorch |
| Product Manager | Jira, Pricing, Roadmapping, Analytics |
| Product Designer | Interaction Design, Webflow, Design Systems, Figma, Prototyping |
| Product Designer / Product Manager | User Research |
| Account Executive | Enterprise Sales, Negotiation, Pipeline Management, SaaS, Salesforce, Outbound |
| Marketing Manager | Content Marketing, Lifecycle Marketing, SEO, Brand, HubSpot, Paid Social |
| Recruiter | Employer Branding, Greenhouse, Interviewing, Sourcing, Technical Recruiting |

This is a property of the data, not a rule to encode: do **not** infer a role from a skill or vice versa.

### Titles / headlines

`current_title` and `experiences[].title` are always `{level prefix}{role}` (52 distinct current titles = 13 roles
× 4 levels). Past-title prefixes: Junior 2654, Senior 2538, (none) 2223, Staff 2205. Headlines are
`{current_title} · {first three skills}`. So titles/headlines carry nothing beyond `role`, `seniority` and
`skills`.

### Companies — 28 values, the only attribute is `company_type`

Each company has a single, fixed `company_type` across all 9620 experience rows (0 companies with two types).
Counts are experience rows (a candidate can have several rows at one company).

| startup (16) | rows | enterprise (12) | rows |
|---|---|---|---|
| Copperline | 338 | Meridian Financial | 431 |
| Fernway | 325 | Ironclad Systems | 417 |
| Brightpath | 321 | Globalcorp | 414 |
| Arcadia Robotics | 318 | Summit Telecom | 414 |
| Driftwood Data | 311 | Atlas Retail | 409 |
| Paperplane | 308 | Harborview Health | 407 |
| Quillstack | 307 | Keystone Logistics | 396 |
| Northwind AI | 305 | Beacon Energy | 384 |
| Kitebird | 302 | Titan Software | 372 |
| Hexlane | 301 | Crescent Media | 368 |
| Orbitly | 301 | Pinnacle Insurance | 367 |
| Tidal Health | 294 | Evergreen Bank | 364 |
| Mintleaf | 293 | | |
| Saltbox | 288 | | |
| Lumen Labs | 288 | | |
| Pebblepay | 277 | | |

**"Worked at a startup"** is answered exactly by
`EXISTS (experience WHERE company_type = 'startup')` — **any** job, current or past. 3394 candidates qualify
(current job at a startup: 2477; current job at an enterprise: 2523). There is **no** size, headcount, funding,
stage, industry or "FAANG" attribute. Company names hint at industries ("Tidal Health", "Evergreen Bank",
"Northwind AI") but that is not data — do not infer industry from names.

### Education (one entry per candidate)

- **Degrees (5):** BS 2447 · BA 1152 · MS 996 · MBA 215 · PhD 190. Every degree occurs with every field.
- **Schools (13):** University of Washington 426 · MIT 416 · Georgia Tech 406 · Columbia University 401 ·
  New York University 395 · University of Michigan 395 · Carnegie Mellon University 384 · Cornell University 383 ·
  University of Illinois 382 · Northeastern University 381 · University of Texas at Austin 351 · UC Berkeley 344 ·
  Stanford University 336.
  Note the mixed naming ("MIT", "UC Berkeley" vs "Stanford University") — normalization must map short forms
  ("Stanford", "Berkeley", "CMU", "UW", "UT Austin", "NYU", "Columbia", "Cornell", "Georgia Tech", "UIUC") to these.
- **Fields of study (14):** Mathematics 844 · Computer Science 835 · Electrical Engineering 762 ·
  Computer Engineering 703 · Psychology 358 · Economics 313 · Marketing 262 · Business 262 · Communications 235 ·
  Human-Computer Interaction 102 · Design 100 · Fine Arts 94 · Physics 68 · Statistics 62.
- `graduation_year` 2010–2026.

### Absent concepts

A grep over the raw file finds no occurrence of `language`, `Japanese`, `Spanish`, `remote`, `visa`, `salary`,
`industry`. There are no fields for spoken languages, remote/relocation preferences, work authorization,
compensation, certifications, gender, age, contact details, or company industry/size.

---

## 3. The 10 sample queries — reproducing the expected sets

For each brief I wrote the filter that reproduces `expected_ids` and nearby alternative interpretations.
P = precision, R = recall against `expected_ids`.

| # | Brief | Filter that matches exactly | got/exp | P | R |
|---|---|---|---|---|---|
| 1 | senior React engineers in New York who have worked at a startup | `seniority = senior` ∧ skill `React` ∧ city `New York` ∧ any experience `company_type = startup` | 21/21 | 1.000 | 1.000 |
| 2 | product designers in San Francisco who are open to work | role `Product Designer` ∧ city `San Francisco` ∧ `open_to_work` | 29/29 | 1.000 | 1.000 |
| 3 | data scientists with a PhD | role `Data Scientist` ∧ degree `PhD` | 47/47 | 1.000 | 1.000 |
| 4 | backend engineers in Austin who know Go and Kubernetes | role `Backend Engineer` ∧ city `Austin` ∧ skills `Go` **and** `Kubernetes` | 7/7 | 1.000 | 1.000 |
| 5 | staff full stack engineers in Seattle | `seniority = staff` ∧ role `Full Stack Engineer` ∧ city `Seattle` | 18/18 | 1.000 | 1.000 |
| 6 | machine learning engineers who studied at Stanford | role `Machine Learning Engineer` ∧ school `Stanford University` | 21/21 | 1.000 | 1.000 |
| 7 | account executives in Chicago with enterprise sales experience | role `Account Executive` ∧ city `Chicago` ∧ skill `Enterprise Sales` | 22/22 | 1.000 | 1.000 |
| 8 | junior frontend engineers in Boston who are open to work | `seniority = junior` ∧ role `Frontend Engineer` ∧ city `Boston` ∧ `open_to_work` | 2/2 | 1.000 | 1.000 |
| 9 | mobile engineers who know Swift | role `Mobile Engineer` ∧ skill `Swift` | 199/199 | 1.000 | 1.000 |
| 10 | product managers who speak Japanese | — (no language data) → **empty**, `unsupported: ["speaks Japanese"]` | 0/0 | — | — |

Alternative interpretations that the expected sets **reject**:

| # | Alternative | got | P | R | Conclusion |
|---|---|---|---|---|---|
| 1 | startup = **current** job only | 19 | 1.000 | 0.905 | "has worked at" = **any** experience (2 expected people were at a startup only in the past) |
| 1 | `seniority ∈ {senior, staff}` ("senior or above") | 52 | 0.404 | 1.000 | "senior" = **exact level** |
| 1 | `years_experience ≥ 6` | 52 | 0.404 | 1.000 | not a years threshold |
| 1 | skill matches `/react/i` (adds React Native) | 27 | 0.778 | 1.000 | skills match **exactly** |
| 1 | drop the startup clause | 34 | 0.618 | 1.000 | every clause is a hard filter |
| 2 | state `CA` instead of city | 45 | 0.644 | 1.000 | "in San Francisco" = **city** |
| 2 | ignore open_to_work | 66 | 0.439 | 1.000 | "open to work" is a hard filter |
| 3 | PhD or MS | 101 | 0.465 | 1.000 | degree is exact ("with a PhD" = PhD) |
| 4 | Go **or** Kubernetes | 35 | 0.200 | 1.000 | multiple skills = **AND** |
| 5 | `years_experience ≥ 10` | 18 | 1.000 | 1.000 | equivalent here (disjoint bands); use `seniority` for consistency with #1 |
| 7 | any experience at an `enterprise` company | 21 | 0.714 | 0.682 | "enterprise sales experience" = the **skill**, not company type |
| 7 | drop the clause | 30 | 0.733 | 1.000 | — |
| 8 | ignore open_to_work | 10 | 0.200 | 1.000 | — |
| 9 | Swift **or** iOS | 269 | 0.740 | 1.000 | the named skill only; no skill expansion |
| 9 | role only | 320 | 0.622 | 1.000 | — |
| 10 | ignore the language requirement | 411 | 0.000 | — | a material unsupported requirement ⇒ **0 results**, not "all PMs" |

Composition of the expected sets (role/seniority): #1 = 15 senior Full Stack + 6 senior Frontend (the
"React engineers" phrase needs no role filter — the skill already selects them; `role ∈ {Frontend, Full Stack}`
gives the same set); #2, #3, #4, #6, #7, #9 span all four seniority levels (no hidden seniority filter);
#5 all staff; #8 all junior. Query 4 gives the same 7 with or without the role filter (Go is Backend-only).

### Grader matching semantics (general rules, derived above)

1. **Job nouns → `role`** (exact enum value). Since every past title has the current role, "current role" and
   "has been a X" are the same set in this data.
2. **Level words → `seniority`, exact.** junior/mid/senior/staff; "senior" does *not* include staff.
   Explicit numeric asks ("5+ years") → `years_experience` range.
3. **Place → `location.city`**, exact. A state ("in California", "Texas") → `location.state`. Anything else is not in the data.
4. **Skills → exact canonical value; several skills = AND** (all required).
5. **"Has worked at a startup / an enterprise / company X" → any experience** (current or past). Only "currently
   at …" restricts to `experiences[0]`.
6. **Booleans like "open to work" are hard filters.**
7. **Education: degree, school and field are exact** after normalization of synonyms.
8. **All clauses are ANDed and every clause is a hard filter.** Ranking only orders the matching set.
9. **Unsupported material requirement ⇒ empty result** with the reason in `filters.unsupported`.

---

## 4. Proposed filter schema

All fields optional; present fields are ANDed. Every string value is validated against the vocabularies in §2
after normalization; values outside them go to `unsupported`.

| Field | Type | Semantics |
|---|---|---|
| `roles` | `Role[]` (13-value enum) | candidate `role` ∈ list (OR within list: "frontend or full stack engineers") |
| `seniority` | `("junior"\|"mid"\|"senior"\|"staff")[]` | `seniority` ∈ list, exact levels; never auto-expanded |
| `years_experience` | `{ min?: int 0–50, max?: int 0–50 }` | inclusive range on `years_experience`; only for explicit numbers |
| `locations` | `{ city?: City, state?: State }[]` | candidate matches **any** listed location; city exact, or state exact |
| `open_to_work` | `boolean` | exact |
| `skills_all` | `Skill[]` | candidate has **every** skill (default for "knows X and Y") |
| `skills_any` | `Skill[]` | candidate has **at least one** (only for explicit "X or Y") |
| `companies` | `{ names: Company[], scope: "any" \| "current" }` | worked at one of these (any job by default) |
| `company_type` | `{ value: "startup" \| "enterprise", scope: "any" \| "current" }` | e.g. "worked at a startup" = `{startup, any}` |
| `degrees` | `("BS"\|"BA"\|"MS"\|"MBA"\|"PhD")[]` | degree ∈ list |
| `schools` | `School[]` | school ∈ list |
| `fields_of_study` | `Field[]` | field ∈ list |
| `unsupported` | `{ term: string, reason: string }[]` | requirements the data cannot express (see below) |

Normalization guidance (general synonym tables, not per-query rules):

- Locations: NYC / New York City / Manhattan → New York; SF / Bay Area → San Francisco; LA → Los Angeles;
  US state names/abbreviations → `state` code. "Remote", "US", other cities/countries → unsupported.
- Roles: "frontend/front-end/UI engineer" → Frontend Engineer; "full-stack/fullstack" → Full Stack Engineer;
  "ML engineer/MLE" → Machine Learning Engineer; "SRE/platform/infrastructure" → DevOps Engineer;
  "iOS/Android engineer" → Mobile Engineer (*plus* the iOS/Android skill only if the brief says so);
  "AE/sales rep" → Account Executive; "PM" → Product Manager; "designer/UX/UI designer" → Product Designer;
  "recruiter/talent partner" → Recruiter. A generic "engineer"/"developer" with no specific role → no role filter.
- Seniority: junior/entry-level/new grad → junior; mid-level → mid; senior/sr → senior; staff → staff.
  "Lead", "principal", "director", "head of", "intern" do not exist as levels → unsupported (don't guess).
- Skills: Golang → Go; k8s → Kubernetes; PostgreSQL → Postgres; JS → JavaScript; TS → TypeScript;
  Rails → Ruby on Rails; Node → Node.js; Next → Next.js; TF → TensorFlow (or Terraform — ambiguous, ask the
  model to keep the brief's word); "ML" (as a skill) → Machine Learning; "A/B tests" → A/B Testing.
  Unknown skills (e.g. "C++", "Angular", "Excel") → unsupported.
- Degrees: "PhD/doctorate" → PhD; "master's" → MS + MBA (MBA is a master's); "MBA" → MBA;
  "bachelor's" → BS + BA; "advanced/graduate degree" → MS, MBA, PhD.
- Schools: short names → canonical (Stanford → Stanford University, Berkeley → UC Berkeley, CMU → Carnegie
  Mellon University, UW → University of Washington, UIUC → University of Illinois, UT Austin → University of
  Texas at Austin, NYU → New York University, Columbia/Cornell/Michigan/Northeastern/Georgia Tech/MIT).
  "Ivy League", "top school" → unsupported (no tiering in data; don't hand-pick a list).
- Phrases that sound like company type but are skills: "enterprise sales" → skill Enterprise Sales;
  "SaaS sales" → skill SaaS. "Enterprise experience"/"big company" → `company_type = enterprise`.

**Deliberately cannot express (→ `unsupported`; if material, the search returns 0 results):**

- Spoken languages ("speaks Japanese"), remote/hybrid/relocation, visa/work authorization, salary, notice period,
  certifications.
- Company industry, size, funding stage, "FAANG", "unicorn", "YC" — only `startup`/`enterprise` exists.
- Any city, state, country, company, school, skill, role or level not in the §2 vocabularies.
- Tenure / dates ("3+ years at a startup", "graduated after 2020", "left within the last year") — the timeline exists
  but is out of scope for v1; can be added later as explicit fields if needed.
- Free-text qualities ("rockstar", "great communicator", "passionate").
- **Protected attributes** (gender, ethnicity, age, nationality, religion, …) — never filtered or inferred
  (e.g. from `full_name`); reported as unsupported.
- Contact details (out of scope by contract).

"Never return everyone": if after normalization no supported constraint remains, or any material
requirement landed in `unsupported`, return 0 results with the explanation.

---

## 5. Stripe events (`data/stripe-events.json`)

Five deliveries, in file (= arrival) order:

| # | event id | type | company | subscription | status | `created` (UTC) | sig `t` | outcome |
|---|---|---|---|---|---|---|---|---|
| 1 | evt_sample_acme_1 | customer.subscription.created | acme | sub_sample_acme | active | 2026-10-05 14:40:00 | 1791211200 | applied → acme active |
| 2 | evt_sample_acme_1 | customer.subscription.created | acme | sub_sample_acme | active | 2026-10-05 14:40:00 | 1791211205 | **repeat** (same event id) → no-op, 200 |
| 3 | evt_sample_globex_2 | customer.subscription.updated | globex | sub_sample_globex | active | 2026-10-05 14:42:00 | 1791211330 | applied → globex active |
| 4 | evt_sample_globex_1 | customer.subscription.created | globex | sub_sample_globex | incomplete | 2026-10-05 14:41:00 | 1791211335 | **out of order** (older than stored) → ignored, 200 |
| 5 | evt_sample_acme_2 | customer.subscription.deleted | acme | sub_sample_acme | canceled | 2026-10-05 14:43:00 | 1791211380 | applied → acme canceled |

- **Event types present:** `customer.subscription.created`, `customer.subscription.updated`,
  `customer.subscription.deleted`.
- **Repeat:** deliveries 1 and 2 have the identical payload and event id but a *different* signature timestamp
  (`t=…200` vs `t=…205`) and therefore a different signature. Dedupe must key on **`event.id`**, not on the
  signature or the raw body hash.
- **Out-of-order pair:** globex `evt_sample_globex_2` (updated → active, created 14:42) arrives before
  `evt_sample_globex_1` (created → incomplete, created 14:41). Ordering must use **`event.created`** (the payload
  field), not arrival order and not the signature `t` (which is the send time: 1791211330 vs 1791211335 would
  wrongly rank the stale event as newer).
- **Where things live:** company slug in `data.object.metadata.company` (`"acme"` / `"globex"`); subscription
  status in `data.object.status`; subscription id in `data.object.id`; customer in `data.object.customer`;
  `data.object.current_period_end` also present. Top-level `id`, `type`, `created`, `livemode` (false),
  `api_version` (`2025-09-30`).
- **Final state:** acme — `sub_sample_acme` canceled ⇒ **free**; globex — `sub_sample_globex` active ⇒ **paid**.
  This matches the file's `expected_plans_after` (`{ "acme": "free", "globex": "paid" }`), and is reproduced by
  "dedupe on event id, apply only if `created` is newer than stored, paid iff any subscription is
  active/trialing".
- Signature format is `t=<unix>,v1=<hex sha256>` with one `v1`. Signatures are historic (Oct 2026), so a
  timestamp tolerance would reject them; validity can only be checked with the grader's `STRIPE_WEBHOOK_SECRET`
  (not available here, so not verified in this analysis).
