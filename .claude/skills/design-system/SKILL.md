---
name: design-system
description: Create or extend the app's design system — tokens, typography, color, spacing, motion and the core components in src/components — and keep docs/design.md as its source of truth. Use once at the start and whenever a new shared pattern is needed.
---

Design-system task:

$ARGUMENTS

Direction: calm, dense-but-airy, product-grade. Reference points (study their restraint, do not copy
them): Linear (keyboard-first, quiet chrome), Vercel/Geist (typography, neutral greys), Stripe Dashboard
(data tables, status badges), Attio/Notion (people records, side sheets), Raycast (command palette).

1. Read `docs/design.md` if it exists; otherwise create it. It must document every token and component
   with when-to-use rules.
2. Tokens (CSS variables in `globals.css`, mapped into Tailwind v4 `@theme`), light + dark:
   - Neutrals: one cool grey ramp (11 steps); a single accent hue used only for primary action,
     focus and selection; semantic success/warning/danger.
   - Type: Geist Sans + Geist Mono via `next/font` (self-hosted, `display: swap`). Scale
     12/13/14/16/20/24/32, tight line-heights for UI, tabular numbers for counts.
   - Spacing on a 4px grid; radii 6/10/14; shadows: hairline border first, shadow only for overlays.
   - Motion: 150–200 ms ease-out, disabled under `prefers-reduced-motion`.
3. Core components (built on shadcn primitives, in `src/components`):
   AppShell (top bar on mobile, slim sidebar on desktop), SearchBar (large, auto-growing, ⌘K/`/` to focus),
   FilterChip (label · value · edit popover · remove ×), CandidateRow (avatar, name, headline,
   location, years, top skills, shortlist button), CandidateSheet (side sheet desktop / drawer mobile),
   EmptyState (icon, one sentence, one action), ErrorState (message + Retry), Skeletons matching each
   view, PlanBadge + UpgradeDialog, Toasts (sonner) with Undo where an action is destructive.
4. Build a hidden `/dev/design` page that renders every component in every state for visual review
   (excluded from production nav).
5. Verify at 375px and 1280px, light and dark. Run typecheck and lint.
6. Summarize the tokens and components added. Do not commit.
