---
name: design-system
description: Create or extend the app's design system — tokens, typography, color, spacing, motion and the core components in src/components — and keep docs/design.md as its source of truth. Use once at the start and whenever a new shared pattern is needed.
---

Design-system task:

$ARGUMENTS

Direction: the sleek, quiet feel of an LLM tool on a warm, airy page. Search is a centred **composer**
(large rounded box, send button inside, gradient border + soft glow on focus, example briefs as pills) that
docks to the top after a search. Results arrive like a chat answer: **thinking steps** (Reading your brief →
Understanding filters → Finding people → Ranking) with a soft shimmer, then the understood filters pop in as
editable chips, then candidate cards fade up. Reference: the Tsenta screenshots in `design-refs/` (analysis in
docs/design.md §0). Use them as inspiration, never copy assets or branding. Keep the restraint of Linear and
Vercel; borrow composer conventions from LLM chat tools.

1. Read `docs/design.md` if it exists; otherwise create it. It must document every token and component
   with when-to-use rules.
2. Tokens (CSS variables in `globals.css`, mapped into Tailwind v4 `@theme`), light + dark:
   - Neutrals: one warm stone ramp (11 steps), an off-white page with white cards. A single accent,
     **forest green**, used only for primary action, focus, selection and matches. A green→teal
     `--accent-gradient` + `--glow` used ONLY on the composer focus border, the send button, the active
     thinking dot and the upgrade mark. Semantic success/warning/danger as text or tints.
   - Type: **Plus Jakarta Sans** + Geist Mono via `next/font` (self-hosted, `display: swap`). Scale
     12/13/14/16/20/24/32/40; display sizes at weight 500, headings 600, negative tracking growing with
     size; tabular numbers for counts.
   - Spacing on a 4px grid (8px steps preferred). Radii 8/12/16 + pills (buttons, chips, tags,
     suggestions). Shadows: hairline first; a soft `shadow-sm` lift for card hover, `shadow-composer` for
     the composer, `shadow-md+` for overlays.
   - Motion: 150 / 200 / 250 ms ease-out; `chip-in`, `fade-up`, `skeleton-shimmer`, `text-shimmer`. CSS
     only, no animation libraries. All of it disabled under `prefers-reduced-motion`.
3. Core components (built on shadcn primitives, in `src/components`):
   AppShell (translucent top bar + tab bar on mobile, quiet pill sidebar on desktop), Composer (hero /
   docked, auto-growing, ⌘K/`/` to focus; SearchBar wraps it), ThinkingSteps, FilterChip (pill: label ·
   value · edit popover · remove ×, animated entry), CandidateCard (avatar, name, headline, location,
   years, 3 skills with matches tinted, logo, shortlist button on hover / always on touch; `row` appearance
   = CandidateRow), CandidateSheet (floating side sheet desktop / drawer mobile),
   EmptyState (icon, one sentence, one action), ErrorState (message + Retry), Skeletons matching each
   view, PlanBadge + UpgradeDialog, Toasts (sonner) with Undo where an action is destructive.
4. Build a hidden `/dev/design` page that renders every component in every state for visual review
   (excluded from production nav): light and dark side by side (`.theme-light` / `.theme-dark` panes) and a
   375px view (iframes of `/dev/design?frame=1&theme=…`).
5. Verify at 375px and 1280px, light and dark. Run typecheck and lint.
6. Summarize the tokens and components added. Do not commit.
