# Design system

The source of truth for how the recruiter app looks and behaves. Tokens live in `src/app/globals.css`;
components live in `src/components`. Every token and component is shown in every state at **`/dev/design`**
(not linked from the app, `noindex`). Review changes there at 375px and 1280px, in light and dark.

**Direction:** calm, product-grade, dense but with air. Quiet chrome, confident type, hairline borders and one
accent colour. Candidate avatars and company logos are the only colour-rich elements, so they carry the
visual interest. No gradients, illustrations, decorative icons or drop shadows on flat surfaces. If removing
an element loses nothing, remove it.

---

## 1. Tokens

### Colour

Two layers. **Ramps** are the raw values. **Roles** are what components use. Components never use a ramp step
directly. The only exception is `/dev/design`, plus `CompanyLogo`, which always sits on white.

**Grey ramp:** one cool grey (hue 260, low chroma), 11 steps: `--gray-50 … --gray-950`, exposed as
`bg-gray-*` / `text-gray-*`.

**Accent:** a single cobalt hue (`--accent-hue: 262`). It is used **only** for:
- the primary action (`bg-primary`). One primary button per view.
- focus (`--ring`, the focus outline and the SearchBar focus ring)
- selection (`bg-primary-subtle`: the selected row, matched skills, the open chip, the Paid badge, `::selection`)

Never use the accent for decoration, headings, icons or links in body copy.

| Role | Light | Dark | Use |
|---|---|---|---|
| `background` | white | gray-950 | Page and content surfaces |
| `surface` | gray-50 | ≈ gray-925 | Sidebar and page wells |
| `foreground` | gray-950 | gray-50 | Primary text |
| `muted` | gray-100 | ≈ gray-900 | Skeletons, quiet fills |
| `muted-foreground` | gray-500 | gray-400 | Secondary text, labels, icons (≥ 4.5:1 on background) |
| `accent` | gray-100 | ≈ gray-875 | **Neutral** hover/active fill. The name comes from shadcn; it is *not* the brand accent |
| `border` / `border-strong` | gray-200 / gray-300 | white 9% / 16% | Hairlines / hover and dashed borders |
| `input` | gray-200 | white 12% | Form control borders |
| `primary` / `primary-foreground` | cobalt L .53 / white | cobalt L .58 / white | Primary action |
| `primary-subtle` / `-foreground` | cobalt 8% / cobalt L .45 | cobalt 14% / cobalt L .80 | Selection tint |
| `ring` | cobalt | lighter cobalt | Focus |
| `success` / `-subtle` | green | green | "Open to work", success toasts |
| `warning` / `-subtle` | amber | amber | Quota exhausted, unsupported filter |
| `destructive` / `-subtle` | red | red | Errors, destructive buttons |
| `overlay` | gray-950 40% | black 60% | Scrim behind sheets and dialogs |
| `sidebar*` | | | Sidebar-specific variants of the roles above |

Status colours appear as **text or a subtle tint**, never as large solid fills. The one exception is the
destructive button. State is always carried by text as well as colour.

### Typography

Geist Sans and Geist Mono via `next/font/google`, which self-hosts the files at build time (`display: swap`),
exposed as `font-sans` / `font-mono`. The body default is `text-base` (14px).

| Utility | Size / line | Use |
|---|---|---|
| `text-xs` | 12 / 16 | Section labels, counts, badges, kbd |
| `text-sm` | 13 / 18 | Secondary row text, meta, helper text |
| `text-base` | 14 / 20 | Body, row names, controls |
| `text-lg` | 16 / 24 | SearchBar on mobile, inputs below `md` (prevents iOS zoom), empty-state sentence |
| `text-xl` | 20 / 28, −0.01em | SearchBar ≥ sm, sheet name, section titles |
| `text-2xl` | 24 / 30, −0.015em | Page titles |
| `text-3xl` | 32 / 38, −0.025em | Hero heading (rare) |

Note: this scale **replaces** Tailwind's defaults (`text-sm` is 13px, `text-base` is 14px, `text-lg` is 16px).
Weights: 400 for body, 500 (`font-medium`) for names, labels and buttons, 600 (`font-semibold`) for headings
only. Use `tabular-nums` on every count, year and number that can change. Use `font-mono` only for ranks and
technical values.

### Spacing, radii, elevation, motion

- **Spacing:** the 4px grid (Tailwind's default `--spacing: 0.25rem`). Prefer 2/3/4/5/6/8/10 steps.
  Rows use `py-4 px-4 sm:px-5`. Sections in the sheet use `px-5 py-5 sm:px-6`.
- **Radii:** 6 / 10 / 14 only. `rounded-sm`/`rounded-md` = 6 (buttons, inputs, chips, tags at 4 for tiny
  ones), `rounded-lg` = 10 (cards, lists, popovers, dialogs, toasts), `rounded-xl` = 14 (SearchBar, large
  surfaces). `rounded-full` only for avatars, dots and status badges.
- **Elevation:** a hairline border comes first. `shadow-xs`/`shadow-sm` are disabled (they render nothing), so
  shadcn's flat shadows vanish. `shadow-md`/`lg`/`xl` all map to `--shadow-overlay` and are used **only** on
  overlays (popover, dialog, sheet, toast).
- **Motion:** 150 ms default, 200 ms for entering overlays, ease-out (`cubic-bezier(0.16, 1, 0.3, 1)`).
  Animate colour, opacity and transform only. Under `prefers-reduced-motion: reduce`, all animations and
  transitions are effectively disabled globally (skeleton pulse included).
- **Focus:** every interactive element has a visible focus state: the global `:focus-visible` outline
  (2px ring colour) or the shadcn `ring-[3px] ring-ring/50`.

### Theming

`next-themes` with the class strategy (`.dark` on `<html>`), default `system`. `ThemeToggle` cycles
system → light → dark. Every role is redefined under `.dark`. Never hard-code colours. Use roles.

---

## 2. Components

All are in `src/components`. shadcn primitives in `src/components/ui` are restyled by the tokens and kept close
to upstream. Small edits made there: badge variants, button transition, overlay colour, faster sheet motion,
and 16px input text on mobile.

### AppShell — `app-shell.tsx`
The page frame. **≥ 768px:** a 240px sidebar (`SidebarHeader`, `SidebarBody` with `SidebarSection` /
`SidebarItem`, `SidebarFooter`). **< 768px:** a sticky top bar (brand plus the `topBarEnd` slot) and a fixed
56px bottom tab bar (`TabBarItem`) with safe-area padding. Main content gets bottom padding to clear the tab bar.
- Navigation is passed in through slots and `asChild` (wrap a `next/link`), so the shell stays route-agnostic.
- An active sidebar item uses a **neutral** fill, not the accent. Counts are `tabular-nums` and right-aligned.
- Sidebar lists need loading (skeleton rows), empty (one muted sentence) and error (`ErrorState inline`) states.
- Put PlanBadge in the sidebar footer on desktop and in `topBarEnd` on mobile.

### SearchBar — `search-bar.tsx`
The primary input. A large, auto-growing textarea (max height 240px, then it scrolls), 16px on mobile and
20px from sm up. Controlled: the owner holds the value and runs the search.
- Enter submits the trimmed brief. Shift+Enter adds a newline. Esc blurs. **⌘K / Ctrl+K and `/`** focus it
  (`globalShortcut`, on by default; only one bar per page should own it).
- A counter appears above 400 characters. Above 500 the bar shows an error and submit is disabled.
- States: empty (kbd hint), filled, `loading` (spinner in the submit button), `disabled` (quota exhausted;
  pair it with UpgradeDialog), `error` (message under the field, `role="alert"`).

### FilterChip — `filter-chip.tsx`
One understood filter: `label · value`. Click it to edit in a popover; × removes it.
- `editor`: popover body. For closed vocabularies use **`FilterChipOptions`** (cmdk list with checkboxes, and
  a filter input when there are more than 8 options). Values must come from the data vocabulary.
- `unsupported`: dashed amber border, warning icon, struck-through value. The brief asked for it, but it is
  **not applied** (the data can't express it). Explain why in the editor or in the result empty state.
- An open chip has an accent border and ring. `disabled` dims it. Long values truncate (set `max-w-*`).
- Removal is instant. The owner shows `toastUndo`. `AddFilterChip` is the dashed "+ Add filter" trigger.
- Wrap chips in `FilterChipList` (labelled group). The loading state is `FilterChipsSkeleton`.

### CandidateRow — `candidate-row.tsx`
One ranked result: rank (desktop), avatar, name, open-to-work dot, title · logo · company, location, years,
top 3 skills plus an overflow count, and a shortlist button.
- The whole row opens the sheet (the name is a button stretched over the row). The shortlist button sits
  above it with a 44px touch target on mobile.
- States: default, hover / keyboard focus (neutral tint), `selected` (open in the sheet: accent tint and a 2px
  left bar, `aria-current`), `shortlisted` (filled accent bookmark, `aria-pressed`), `shortlistPending`
  (spinner), avatar/logo fallback, truncation.
- `matchedSkills` sorts matched skills first and tints them. This is computed from the search filters, never
  by the LLM.
- `React.memo`: pass stable callbacks that take the id (`onOpen(id)`, `onToggleShortlist(id)`).
- Put rows in `CandidateList` (hairline-divided, `rounded-lg`). The loading state is
  `CandidateListSkeleton` / `CandidateRowSkeleton`. Virtualize result lists with `@tanstack/react-virtual`.
- On mobile, the title and company stack on two lines and the skills wrap.

### CandidateSheet — `candidate-sheet.tsx`
Candidate detail. A 480px right `Sheet` from 768px up, a full-height bottom `Drawer` (scrolls inside) below that.
- `status`: `pending` → `CandidateProfileSkeleton`, `error` → `ErrorState` (Retry when `onRetry` is given;
  omit it for "not found"), `success` → `CandidateProfile`: a header with a 64px avatar, name, headline, current
  company, location, years and the actions slot; an Experience timeline (32px logos on a hairline rail, year range ·
  duration, description); Education; Skills (matched skills first, tinted, with a "N match your search" note).
- Toolbar: an optional previous/next stepper (`onPrevious`/`onNext`, `null` = disabled at that end,
  `positionLabel` "3 of 120") and Close. 44px targets on mobile.
- `actions` slot: one primary (shortlist) plus outline secondaries. In the header from 768px up, and a sticky
  bottom bar on mobile.
- The sheet focuses itself on open, so Esc and the owner's ←/→ binding work straight away.
- Import it with **`next/dynamic`** from feature code. It is heavy and opened on demand.

### CandidateAvatar / CompanyLogo — `candidate-avatar.tsx`, `company-logo.tsx`
`next/image` with explicit `sizes`. Remote SVGs from `rotto.com` are served unoptimized automatically.
- Avatar sizes `sm` 24, `md` 40, `lg` 64. It is round with a hairline inner ring. Initials appear only if
  there is no image or it fails to load. No coloured fallbacks.
- Logo sizes `xs` 16, `sm` 20, `md` 32, `lg` 40. It sits on a white tile with a hairline so logos read the
  same in both themes. A building icon is the fallback.
- Pass `priority` only for the first two rows above the fold.

### Badge · Tag · Kbd
- **Badge** (`ui/badge.tsx`) is **status**: `success`, `warning`, `destructive`, `neutral`, `default`
  (accent-subtle, for "yours/paid"), `secondary`, `outline`. It is a 20px pill with text and a tint.
- **Tag** (`tag.tsx`) is **neutral data** (skills). Hairline, 4px radius, never interactive. `matched` takes
  the accent tint.
- **Kbd** (`kbd.tsx`) is a shortcut hint, hidden on coarse pointers.

### EmptyState — `empty-state.tsx`
An icon, **one sentence** (what happened), an optional short reason, and **one action** (the most useful next
step). `size="compact"` is for sidebars and sheet sections. Examples: no matches → "Edit filters", unsupported
→ say what can't be searched and offer to remove it, empty shortlist → "Find candidates".

### ErrorState — `error-state.tsx`
Says what failed in plain language and offers **Retry** (wire it to React Query `refetch`, and pass
`retrying={isFetching}`). `variant="inline"` is a one-line banner for small areas. Never show codes, stack
traces or SQL.

### Skeletons
Skeletons are shaped like the content they replace: `CandidateRowSkeleton`, `CandidateListSkeleton`,
`FilterChipsSkeleton`, `CandidateProfileSkeleton`, `PlanBadge` with `plan={undefined}`, and sidebar skeleton
rows (see `/dev/design`). Don't use spinners for layout-sized areas. Spinners are only for inline buttons.

### PlanBadge + UpgradeDialog — `plan-badge.tsx`, `upgrade-dialog.tsx`
- **PlanBadge:** free with searches left → neutral button "1 free search left · Upgrade". Free with 0 left →
  amber "No searches left". Paid → accent-subtle "Paid", static. Loading → skeleton. "free" is dropped below
  `sm` to fit the top bar.
- **UpgradeDialog:** a Dialog from 768px up, a Drawer below. `reason="quota"` (after a 402) or `"manual"`
  (from the badge). There is **no checkout** in this app. The copy says the plan updates automatically once
  billing confirms, which happens through the Stripe webhook. Pass `action` only if a real primary action
  exists.

### Toasts — `toast.ts` + `ui/sonner.tsx`
The `<Toaster />` is mounted once in `Providers`. It sits bottom-right on desktop and above the tab bar on
mobile. Toasts are announced politely.
- Confirmations use `toast.success("Added to …")`. Keep them short and quiet.
- Destructive actions happen immediately (optimistically) and call **`toastUndo(message, onUndo)`**
  (6 seconds). Don't use confirmation dialogs for reversible actions. Deleting a whole shortlist may use both.
- Errors use `toast.error("Couldn't … Try again.")` for background mutations. Data views use ErrorState.

### ThemeToggle — `theme-toggle.tsx`
A ghost icon button that cycles system / light / dark. It goes in the sidebar footer.

---

## 3. Rules of thumb

- **Every data view handles four states:** loading (shaped skeleton), empty (EmptyState), error (ErrorState with
  Retry) and success. Result counts use `aria-live="polite"`.
- **Mobile first (375px):** no horizontal scroll, touch targets ≥ 44px, sheets and dialogs become drawers,
  inputs are ≥ 16px.
- **Use one primary button per view.** Everything else is outline or ghost.
- **Use roles, not raw values.** No hex colours, arbitrary font sizes or shadows in feature code.
- **Use `useIsDesktop()`** (`src/hooks/use-media-query.ts`) only to choose *behaviour* (Sheet vs Drawer). It
  returns `false` on the server. Use CSS breakpoints for layout that must be right on first paint.
