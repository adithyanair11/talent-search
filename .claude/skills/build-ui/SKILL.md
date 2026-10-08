---
name: build-ui
description: Build or update recruiter-facing UI (pages, sections, components) using the project design system, shadcn primitives and responsive conventions. Use when creating or significantly changing anything a recruiter sees.
---

Build or update the following UI:

$ARGUMENTS

1. Read `docs/design.md` and inspect the current implementation and related components in
   `src/components` and `src/features/*/components`.
2. Search for reusable components before creating new ones. Extend a design-system component rather
   than restyling a one-off. Use design tokens (CSS variables / Tailwind theme) — no hard-coded colors,
   spacing or font sizes.
3. Keep the change focused on the requested feature. Every element on screen must earn its place:
   if removing it loses nothing, remove it.
4. Data access goes through the feature's React Query hooks (`src/features/<feature>/hooks`), never
   `fetch` inside components. UI-only state (open panels, selection) goes in a zustand store, read with
   narrow selectors.
5. Handle all four states for every data view:
   - loading: skeletons shaped like the final content (no spinners for layout-sized areas)
   - empty: say what happened and offer the next action
   - error: plain-language message + Retry (calls `refetch`)
   - success
6. Responsive: design at 375px first, then 768px and 1280px. Touch targets ≥ 44px, no horizontal
   scroll, dialogs become bottom sheets (`Drawer`) on mobile, sticky primary action where it helps.
7. Accessibility: semantic elements, labelled controls, visible focus ring, keyboard paths
   (Enter submits, Esc closes, `/` focuses search), `aria-live="polite"` for result counts and toasts,
   contrast ≥ 4.5:1, respects `prefers-reduced-motion`.
8. Performance: `next/image` with explicit `sizes` for avatars/logos; `next/dynamic` for sheets,
   dialogs and anything below the fold; `React.memo` on list rows with stable props;
   `useCallback`/`useMemo` only where a memoized child or expensive computation benefits;
   virtualize lists that can exceed ~50 rows; debounce network-bound inputs by 300 ms.
9. Run the app and visually verify at 375px and 1280px (use the browser/Playwright tools if available;
   otherwise describe exactly what to check). Test loading/empty/error by forcing them (throttle, bad id,
   stopped API).
10. Run `npm run typecheck && npm run lint && npm test`. Fix reproducible issues without expanding scope.
11. Summarize what changed, which components were reused vs created, and anything for the user to check
    by eye. Do not commit.
