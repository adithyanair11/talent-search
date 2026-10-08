# Design system

The source of truth for how the recruiter app looks and behaves. Tokens live in `src/app/globals.css`;
components live in `src/components`. Every token and component is shown in every state at **`/dev/design`**
(`make dev` only, 404 in production builds; not linked from the app, `noindex`), in light and dark side by side, with a **375px** view (real-viewport
iframes). Review every change there.

**Direction:** the sleek, quiet feel of an LLM tool. The search is a centred composer on an airy, warm page.
After a search the composer docks to the top, the pipeline steps play, the understood filters pop in as
chips, and candidate cards rise in like a chat answer. Use warm stone neutrals, one forest-green accent,
pills for everything you can press, 12–16px cards, hairlines first, and soft depth. Avatars and company logos
are the only colour-rich content. If removing an element loses nothing, remove it.

---

## 0. Reference analysis (`design-refs/`)

`design-refs/` holds two screenshots, both from the career site Tsenta: a job-feed grid and its assistant
panel. There are no other AI-tool screenshots in the folder, so the "LLM tool" cues below come from the
assistant panel plus well-known composer conventions. These are notes on what makes them feel good, used as
inspiration. No assets, logos or names were copied.

| Aspect | What the references do | What we take |
|---|---|---|
| **Typeface** | A geometric sans with a large x-height, round o/a/e, and open default tracking. | **Plus Jakarta Sans** (variable, `next/font`). It has the same geometric warmth, real tabular figures, and holds up at 13px. |
| **Weights** | Big text is **regular**, not bold ("Add Your Own Link" ≈ 36px/400; "How can I help?" ≈ 32px/500). Hierarchy comes from size and colour. | Display sizes (`3xl`, `4xl`) use **500**. Headings use 600. Body is 400. Muted grey carries the secondary hierarchy. |
| **Sizes** | UI text ≈ 15–16px; meta text is smaller and grey; long sub-copy sits under centred titles. | Keep the product-density scale (14px body). Add `text-4xl` (40px) for the hero. Sub-copy is `text-lg` muted. |
| **Tracking** | Slightly tighter on display text, neutral on UI text. | −0.01 → −0.03em, growing with size. Names use −0.005em. |
| **Colour** | Warm off-white page (≈ #F9F8F6), white cards, near-black text, deep **forest green** for the active state ("1 left" pill, applied filter chips). Pastel card tints (mint, butter, sky, blush). | Warm stone ramp, an off-white `background`, white `card`, and **forest green as the only accent**. We drop the pastels: on people data they are noise and imply categories that don't exist. |
| **Shape** | Everything you can press is a **pill**: chips, CTAs, suggestions. Cards and the composer are ≈ 16px radius. | Buttons, chips, tags, badges and suggestions are `rounded-full`. Cards are 12px; the composer, sheet and dialog are 16px. |
| **Depth** | Hairline borders and very soft, wide shadows. No hard drop shadows. | Hairline first. `shadow-sm` is a soft lift (card hover); `shadow-composer` is the composer; `shadow-lg` is for overlays. |
| **Composer** | A large rounded box with a 1px grey border. The circular send button sits *inside* at the bottom right and is grey until there is text. It is anchored low with lots of air above. | Exactly that, plus a green→teal gradient border and a soft glow on focus. The send button turns gradient when ready. |
| **Suggestions** | Full-width pills with a coloured circular icon on the left. | Suggestion pills with a small green-tinted icon circle. They wrap and centre on desktop and stack full-width on mobile. |
| **Filters** | "Label · count · ×" chips, filled dark when applied, plus a quiet "× Clear" text action. | FilterChip pills: muted label, strong value, a round × target, and a quiet "Clear all". |
| **Icons** | Thin line icons at text size. | lucide at 14–16px, 2px stroke (1.5 visually at these sizes), muted by default. |
| **Rhythm** | Generous internal padding (24–32px) on an 8px rhythm. | A 4px grid with 8px steps preferred. Cards use 16–20px padding; hero sections get 40–56px of air. |
| **Ignored on purpose** | "72% match" rings. | Our ranking is a deterministic SQL score, so a percentage would invent precision and imply the model judged people. See decisions.md. |

---

## 1. Tokens

### Colour

Colour has two layers. **Ramps** are raw values; **roles** are what components use. Components never use a
ramp step directly. The exceptions are `/dev/design` and `CompanyLogo`, which always sits on white.

**Stone ramp:** one warm grey (hue 70–85, very low chroma), 11 steps: `--gray-50 … --gray-950`, exposed as
`bg-gray-*` / `text-gray-*`.

**Accent:** forest green (`--accent-hue: 160`). Use it **only** for:
- the primary action (`bg-primary`), with one primary button per view.
- focus (`--ring`).
- selection and matches (`bg-primary-subtle`): the selected card, matched skills, an open chip, done thinking
  steps, `::selection`.

Never use it for decoration, headings, or links in body copy.

**Gradient (`--accent-gradient`, green → teal) and glow (`--glow`)** appear in only four places: the
composer's focus border, the send button, the active thinking dot, and the UpgradeDialog mark. Never use them
on text, cards or page backgrounds.

| Role | Light | Dark | Use |
|---|---|---|---|
| `background` | warm off-white (L .984) | warm near-black (L .165) | The page |
| `surface` | L .968 | L .185 | Sidebar wash, sheet header gradient, benefit boxes |
| `card` / `popover` | white | L .198 / .215 | Cards, composer, chips, overlays |
| `foreground` | gray-950 | L .96 | Primary text |
| `muted` | gray-100 | white 6% | Skeleton base, quiet fills, the empty send button |
| `muted-foreground` | gray-500 | L .70 | Secondary text, labels, icons (≥ 4.5:1) |
| `accent` | ink 5% | white 6% | **Neutral** hover fill (the shadcn name; not the brand accent) |
| `border` / `border-strong` | ink 9% / 16% | white 8% / 15% | Hairlines / hover and dashed borders |
| `primary` / `-foreground` | green L .42 / near-white | green L .76 / deep green | Primary action |
| `primary-subtle` / `-foreground` | green 10% / green L .40 | green 14% / green L .84 | Selection and match tint |
| `ring` | green | light green | Focus |
| `success`, `warning`, `destructive` (+ `-subtle`) | | | Open to work · quota / unsupported · errors |
| `overlay` | ink 32% | black 60% | Scrim |
| `--accent-gradient`, `--glow`, `--shimmer` | | | See above; `--shimmer` is the skeleton sweep highlight |

Status colours appear as **text or a subtle tint**, never as large solid fills. The exceptions are the
destructive button and the paid "Pro" pill (solid primary). State is always carried by text as well as
colour.

### Typography

**Plus Jakarta Sans** (`--font-jakarta` → `font-sans`) and Geist Mono (`font-mono`), both via
`next/font/google`, self-hosted at build time with `display: swap`. The body default is `text-base` (14px).

| Utility | Size / line | Weight | Use |
|---|---|---|---|
| `text-4xl` | 40 / 46, −0.03em | 500 | Hero composer title ("Who are you looking for?") |
| `text-3xl` | 32 / 38, −0.025em | 500 | Hero on mobile, rare page heroes |
| `text-2xl` | 24 / 30, −0.015em | 600 | Page and section titles, the sheet's name |
| `text-xl` | 20 / 28, −0.01em | 400 | Hero composer input (≥ sm), dialog titles (600) |
| `text-lg` | 16 / 24 | 400–600 | Composer input on mobile, hero sub-copy, empty-state sentence |
| `text-base` | 14 / 20 | 400 / 600 names | Body, card names, controls |
| `text-sm` | 13 / 18 | 400 | Meta, secondary text, chips |
| `text-xs` | 12 / 16 | 500 | Badges, counts, kbd; section labels (uppercase, +0.06em) |

This scale **replaces** Tailwind's defaults. Use `tabular-nums` on every count, year and number that changes.
Use `font-mono` only for ranks and technical values. `h1–h3` get `text-wrap: balance`.

### Spacing, radii, elevation, motion

- **Spacing:** a 4px grid; prefer 8px steps. Cards use `px-4 py-4 sm:px-5`. Sheet sections use
  `px-5 py-5 sm:px-6`. Heroes get `py-10`–`py-14` of air.
- **Radii:** `rounded-md` 8 (inputs in popovers, logos, menu items), `rounded-lg` 12 (cards in dense
  contexts), `rounded-xl` / `rounded-2xl` 16 (cards, composer, sheet, dialog, popovers, toasts),
  `rounded-full` (buttons, chips, tags, badges, suggestions, sidebar items, avatars). `rounded-xs` 6 is for
  tiny marks only.
- **Elevation:** a hairline border comes first. `shadow-sm` is a soft lift for card hover and suggestion
  hover. `shadow-composer` is the composer at rest. `shadow-[var(--glow)]` is the composer focus halo.
  `shadow-md`/`lg`/`xl` are the overlay shadow (popover, dialog, sheet, toast). `shadow-xs` renders nothing,
  so shadcn's flat shadows vanish.
- **Motion:** use ease-out (`cubic-bezier(0.16, 1, 0.3, 1)`): **150ms** for hover and press, **200ms** for
  surfaces (borders, shadows, sheet), **250ms** for entrances. Animate colour, opacity and transform only.
  Keyframes:
  - `animate-chip-in`: fade, 4px rise and 0.96→1 scale. Stagger with `animationDelay: i * 40ms`.
  - `animate-fade-up`: fade and 6px rise, for result cards (stagger 60ms), empty and error states, and hero text.
  - `skeleton-shimmer` (utility): a soft sweep on `bg-muted`, used by every `Skeleton`.
  - `text-shimmer` (utility): a light sweep across the active thinking step.
  - `animate-pulse-dot`: the active step's dot.

  Under `prefers-reduced-motion: reduce`, every animation and transition is effectively off, and
  `text-shimmer` becomes plain foreground text.
- **Focus:** every interactive element has a visible focus state, either the global `:focus-visible`
  outline (2px ring) or `ring-[3px] ring-ring/40`. The composer shows focus as its gradient border plus glow.

### Theming

`next-themes` with the class strategy (`.dark` on `<html>`), default `system`. `ThemeToggle` cycles system →
light → dark. Every role is redefined under `.dark`. **Scoped themes:** `.theme-light` / `.theme-dark` on any
element re-declare the roles for that subtree, and the `dark:` variant respects them. They exist so
`/dev/design` can show both themes side by side; app code never uses them. Overlays portal to `<body>` and
follow the global theme.

---

## 2. Components

All live in `src/components`. The shadcn primitives in `src/components/ui` are restyled by the tokens and kept
close to upstream. The edits made there:
- Buttons are pills, with an inset highlight on the primary.
- `lg` is 44px.
- Popovers, dialogs and menus are 16px.
- Inputs are 12px.
- Skeletons shimmer.
- Toasts are 16px.

### Composer — `composer.tsx`
The brief input, styled like an LLM composer. It is controlled: the owner holds the value and runs the search.
- **`variant="hero"`** (first visit, empty results page):
  - Layout: a centred `title` (`text-3xl sm:text-4xl`, 500) and one line of `description`, then a roomy box
    (min 2 lines, 20px text ≥ sm).
  - The footer row holds the "↵ to search · ⇧↵ new line" hint (hidden on touch), the counter and the circular
    send button.
  - `suggestions` (`{ label, icon? }[]`) render as pills under the box. They fade up with a 60ms stagger, and
    `onSuggestion(brief)` fires on click.
- **`variant="docked"`** (default; above results): a single-row box with the send button inside, ⌘K hint
  when empty, and auto-grow up to 160px.
- **`meta`**: a quiet line under the box (centred in the hero, right-aligned when docked). The search page puts
  `SearchQuota` here, so searches left always sit next to the composer.
- **Keys:** Enter submits the trimmed brief, Shift+Enter adds a newline, Esc blurs. **⌘K / Ctrl+K and `/`**
  focus it (`globalShortcut`; exactly one composer per page owns it).
- **States:**
  - rest (hairline + `shadow-composer`)
  - hover (`border-strong`)
  - **focus** (gradient border + `--glow`)
  - filled (send turns gradient)
  - `loading` (spinner in send)
  - `disabled` (quota exhausted; pair with UpgradeDialog)
  - `error` (destructive border, message below, `role="alert"`)
  - too long (> 500 chars: counter from 400, error, send disabled)
- `SearchBar` (`search-bar.tsx`) is a backwards-compatible wrapper: `<Composer variant="docked" />`.

### ThinkingSteps — `thinking-steps.tsx`
The AI "working" state. Use it instead of a spinner while a search runs.
- Steps: **Reading your brief → Understanding filters → Finding people → Ranking**.
  - Done steps show a green check in a tint.
  - The active step shows a gradient pulsing dot and a `text-shimmer` label.
  - Upcoming steps show an empty ring with muted text.
- `useThinkingSteps(running, usesModel)` returns the active index. It advances on timers
  (0 / 0.7 / 1.5 / 2.3s) and **holds the last step until `running` turns false**. It is presentational only:
  the API is one request with no streaming (decisions.md). Edited-filter runs (`usesModel=false`) skip the
  first two steps.
- Layout uses a container query: a vertical list in narrow containers, one horizontal row with connectors from
  `@2xl` (≈ 672px).
- Wrap it in `ThinkingPanel` (16px card, fades up). Below it, show `FilterChipsSkeleton` and
  `CandidateCardListSkeleton` so the layout doesn't jump.
- Accessibility: one visually hidden `role="status"` announces the active step. The visual list is
  `aria-hidden`.

### FilterChip — `filter-chip.tsx`
One understood filter, as a pill: muted `label`, strong `value`, and a round × target.
- `editor` is the popover body (an open chip gets an accent border, a subtle tint and a 3px ring). For closed
  vocabularies use **`FilterChipOptions`** (cmdk list with round checkboxes, plus a filter input above 8
  options). Values must come from the data vocabulary.
- `animateIn` and `index`: the post-search entrance (`chip-in`, staggered 40ms). Use it only when the chips first
  appear for a result set, never on edits.
- `unsupported`: dashed amber border, warning icon, struck-through value, **not applied**. Explain why via
  `hint` or the empty state.
- `disabled` dims the chip. Long values truncate (set `max-w-*`).
- Removal is instant; the owner shows `toastUndo`. `AddFilterChip` is the dashed "+ Add filter" pill.
- **`FilterChipList`** is a labelled group. `heading="Understood"` adds the "✦ Understood" line (what the
  model read from the brief), and `onClear` adds a quiet "× Clear all". `listClassName` styles the chip row itself
  (the search page makes it one horizontally scrolling row below `sm`). The loading state is
  `FilterChipsSkeleton` (pill-shaped).

### CandidateCard — `candidate-card.tsx`
One ranked result, laid out as:
- avatar 40, then name (600) with an "Open to work" pill
- title **at** logo · company
- location · years
- 3 key skills, matched first and green-tinted with a screen-reader note, then "+N"
- rank (desktop, mono)
- the shortlist control (`renderShortlist` slot)

Behaviour:
- The whole card opens the sheet: the name is a button stretched over the card. The shortlist control sits
  above it.
- **The shortlist control is always visible** (shortlisting is the main action on a result and must be obvious
  at first glance): a "🔖 Shortlist" outline pill from `sm` up, a 44px round bookmark below `sm`. Shortlisted
  (`aria-pressed`) turns it green-tinted with a filled bookmark and "Shortlisted".
- States: default, hover / keyboard focus (`border-strong` + soft shadow), `selected` (open in the sheet:
  green border, tint and ring; `aria-current`), shortlisted, pending, avatar/logo fallback, truncation.
- `appearance="card"` (default) is a standalone 12px card. Stack them in **`CandidateCardList`** (8px gap).
  For virtualised lists, absolutely position each card and put the gap in its wrapper.
- `appearance="row"` is flat, for a hairline-divided **`CandidateList`** (shortlist pages, dense virtualised
  lists). `CandidateRow` / `CandidateRowSkeleton` / `CandidateList(Skeleton)` in `candidate-row.tsx` are
  this appearance and keep the old imports working.
- `ShortlistIconButton`: that control. Labelled pill ≥ `sm`, round icon button below (the `aria-label` always
  names the person), filled and tinted when on any list, spinner when pending. It forwards its ref, so a Popover or
  Drawer trigger can wrap it.
- `React.memo`: pass stable callbacks that take the id (`onOpen(id)`) and a stable `renderShortlist`.
- Loading: `CandidateCardSkeleton` and `CandidateCardListSkeleton` (same shape, shimmer).
- `matchedSkills` is computed from the search filters, never by the LLM.

### CandidateSheet — `candidate-sheet.tsx`
Candidate detail.
- **≥ 768px:** a **floating** 480px right sheet (inset 8px, 16px radius, hairline, overlay shadow).
- **Below 768px:** a full-height bottom drawer.

Contents:
- Header: a soft `surface` gradient, 64px avatar, name `text-2xl`/600, headline, company · location · years,
  an "Open to work" badge, and the `actions` slot (pill buttons: one primary plus outline).
- Sections (Experience timeline, Education, Skills) use uppercase 12px labels. Matched skills come first and
  are tinted, with a "N match your search" note.
- Toolbar: an optional previous/next stepper with `positionLabel`, and Close. Targets are 44px on mobile.
- On mobile, `actions` move to a sticky bottom bar.

Behaviour:
- The sheet focuses itself on open, so Esc and ←/→ work straight away.
- Load it with **`next/dynamic`**.

### CandidateAvatar / CompanyLogo — `candidate-avatar.tsx`, `company-logo.tsx`
`next/image` with explicit `sizes`. Remote SVGs are served unoptimized.
- Avatar sizes: `sm` 24, `md` 40, `lg` 64. Round, hairline inner ring, initials only on failure.
- Logo sizes: `xs` 16, `sm` 20, `md` 32, `lg` 40. A white tile in both themes; a building icon is the fallback.
- Pass `priority` only for the first two results.

### Badge · Tag · Kbd
- **Badge** (`ui/badge.tsx`) is **status**: `success`, `warning`, `destructive`, `neutral`, `default`
  (green-subtle), `secondary`, `outline`. It is a 20px pill.
- **Tag** (`tag.tsx`) is **neutral data** (skills): a 24px hairline pill, never interactive. `matched` takes
  the green tint and weight 500.
- **Kbd** (`kbd.tsx`) is a shortcut hint, hidden on coarse pointers.

### EmptyState — `empty-state.tsx`
- A 48px green-tinted **circle** icon, **one sentence** (`text-lg`/600), an optional short reason, and **one
  action** (pill). It fades up.
- `size="compact"` is for sidebars and sheet sections.
- Examples: no matches → "Edit filters"; unsupported → say what can't be searched and offer to remove it;
  empty shortlist → "Find candidates".

### ErrorState — `error-state.tsx`
- Says what failed in plain language and offers a pill **Retry** with a spinning icon while `retrying`. Wire it
  to React Query `refetch`.
- The block variant uses a 48px destructive-tint circle.
- `variant="inline"` is a 16px-radius soft destructive bar for small areas.
- Never show codes, stack traces or SQL.

### Skeletons
- Every skeleton **shimmers** (`skeleton-shimmer`) and is shaped like the content it replaces:
  `CandidateCardSkeleton`, `CandidateRowSkeleton`, the list skeletons, `FilterChipsSkeleton` (pills),
  `CandidateProfileSkeleton`, `PlanBadge plan={undefined}`, and the sidebar rows.
- On the results page, skeletons sit under `ThinkingPanel`.
- Spinners are only for inline buttons (send, retry, pending bookmark).

### PlanBadge + UpgradeDialog — `plan-badge.tsx`, `upgrade-dialog.tsx`
- **PlanBadge** is a 32px pill:
  - free → "✦ 1 free search left [Upgrade]" (the Upgrade segment is a small solid green pill)
  - 0 left → amber "0 searches left [Upgrade]"
  - Pro → solid green "✦ Pro", static
  - loading → pill skeleton

  "free search(es)" is dropped below `sm`.
- **SearchQuota** (`features/plan/components/search-quota.tsx`) is unchanged in behaviour.
- **UpgradeDialog:**
  - A Dialog from 768px up, a Drawer below.
  - Layout: a 44px gradient circle mark with sparkles, the title, the description, benefits in a `surface`
    box with tinted checks, and the webhook note.
  - `reason="quota"` | `"manual"`. **No checkout:** pass `action` only if a real primary action exists.

### Shortlist popover — `features/shortlists/components/shortlist-menu*.tsx`
- A 16px-radius popover (≥ 768px) or bottom drawer, containing:
  - a "Find a list…" input
  - rows with **round** `CheckboxIndicator`s, name and count (12px-radius hover rows)
  - a green "+ New list…" footer
- Ticking is optimistic, with an Undo toast. Only classNames changed in the redesign.

### AppShell / nav — `app-shell.tsx`
- **≥ 768px:** a 240px warm sidebar (`surface` wash, hairline right edge).
  - Brand: a green round mark with the name, at the top.
  - Section labels are uppercase 12px. "Recent saved" lists the latest saved searches (click re-runs).
  - **Pill items** (36px). The active item is a raised card (white, soft shadow, hairline) with a green icon.
  - The footer holds the PlanBadge and ThemeToggle, then (above a hairline) the company / account menu.
- **< 768px:**
  - a translucent sticky top bar (`backdrop-blur-xl`, hairline)
  - a translucent 56px bottom tab bar where the active tab is green with a softly filled icon
  - safe-area padding
- Slots and `asChild` keep it route-agnostic. Sidebar lists need loading, empty and error states.

### AvatarStack · CheckboxIndicator · ConfirmDialog · Toasts · ThemeToggle
- `AvatarStack`: up to 4 overlapping 24px avatars plus a "+N" pill. It is decorative, so state the count in text.
- `CheckboxIndicator`: a round 16px check used inside toggling `CommandItem`s.
- `ConfirmDialog`: only for hard-to-undo destructive actions (deleting a shortlist). Load it with `next/dynamic`.
- **Toasts** (sonner, 16px radius): quiet confirmations; destructive actions happen immediately with
  **`toastUndo`** (6s); errors use `toast.error("Couldn't … Try again.")`.
- `ThemeToggle`: a ghost icon button cycling system / light / dark.

---

## 3. The search flow (spec for the page work)

1. **Empty state:** a `Composer variant="hero"` centred in the content column (vertically off-centre,
   ≈ 30% from the top), with `title` "Who are you looking for?", one line of sub-copy, and 3–4 example briefs
   as suggestions. Nothing else on the page.
2. **Submit:** the composer becomes `variant="docked"`. The docked composer, the quota line and the filter
   chips form one sticky header (below the mobile top bar; at the top from `md`), so the understood filters are
   always visible and editable while results scroll. While the brief is read the chips are
   `FilterChipsSkeleton`; below the header, `ThinkingPanel` + `ThinkingSteps` (driven by
   `useThinkingSteps(isPending, usesModel)`) sit over `CandidateCardListSkeleton`.
3. **Response:** the skeleton pills become `FilterChipList heading="Understood" onClear` with chips
   `animateIn` (40ms stagger). Below the header: the model's one-line reading, then the count line
   ("**128** candidates · best match first", `aria-live`) with the **Save search** outline pill on its right,
   then the cards fading up (60ms stagger, the first page only, capped at 480ms).
4. **Edits:** editing or removing a chip re-runs with `usesModel=false` (only "Finding people → Ranking" play).
   Chips don't re-animate. **Clear all** returns to the empty hero composer (nothing runs or is consumed).
5. **Empty / unsupported / error:** EmptyState or ErrorState inside a 16px card, in place of the cards. Search
   errors are written for people: 503 "Search is taking a breather… nothing was used", 429, offline, other.
6. **Quota:** the free plan's "✦ N free search left · Upgrade" sits under the composer (in the mobile docked
   state the top bar's PlanBadge, directly above, carries it). A 402 opens the UpgradeDialog, never an error.

`/dev/design#flow` is a working mock of this sequence.

7. **Login:** the brand, a `text-4xl`/500 "Welcome back", the form in a 16px card with the composer shadow, and
   the two demo accounts as one-click fill cards. From `lg` a still, decorative product glimpse sits beside it
   (`LoginPreview`: composer, Understood chips, card shapes; `aria-hidden`, nothing animates or loops).

---

## 4. Rules of thumb

- **Every data view handles four states:** loading (shaped shimmer), empty (EmptyState), error (ErrorState
  with Retry) and success. Result counts use `aria-live="polite"`.
- **Mobile first (375px):** no horizontal scroll, touch targets ≥ 44px, sheets and dialogs become drawers,
  inputs are ≥ 16px, and hover-only affordances are always visible on touch.
- **One primary button per view.** Everything else is outline or ghost. All of them are pills.
- **Use roles, not raw values.** No hex colours, arbitrary font sizes or ad-hoc shadows in feature code; the
  gradient only appears in its four places.
- **Motion is a garnish:** entrances happen once per result set, never on every re-render, and nothing loops
  except loading and thinking.
- **Use `useIsDesktop()`** (`src/hooks/use-media-query.ts`) only to choose *behaviour* (Sheet vs Drawer). Use CSS
  breakpoints (or container queries) for layout that must be right on first paint.
