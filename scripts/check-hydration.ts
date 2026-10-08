/**
 * Browser check: a full page load of every page must hydrate with zero console errors or warnings.
 *
 * Signs in through the real login form as the globex recruiter (fresh browser profile, no extensions), then
 * full-loads every page, then reloads it twice in the same tab (cold, then warm HTTP cache). Repeat loads are
 * what exposed hydration error #418 (shared React Query data resolving before a streamed page boundary
 * hydrated; docs/decisions.md "Hydration"). Pages: /login, /search (empty), /search?s=, /search?s=&p= (candidate
 * sheet), /shortlists, /shortlists/{id}, /saved; then signs out and back in.
 *
 * Fixtures: globex gets a fixture paid subscription for the run (restored after, with the searches created), one
 * edited-filter search (no LLM call), a shortlist with one person and a saved search, all deleted afterwards.
 *
 * Run with `npm run check:hydration` against `make dev`, or set API_BASE_URL to a `next start` server to check
 * the production build (that is where #418 showed). Uses Playwright's Chromium if installed, otherwise the
 * local Google Chrome. Exits 1 on any console error, console warning or uncaught page error.
 */
import './lib/env'

import { type Browser, chromium, type ConsoleMessage, type Page } from 'playwright'

import { api, API_BASE, PASSWORD, RECRUITER, requireServer, signIn, withCompanyState } from './lib/api'

const TAG = `hydration-${Date.now()}`
/** Long enough for the streamed boundaries to hydrate and the shell's first queries to land. */
const SETTLE_MS = 2500
/** The #418 race showed on repeat loads (warm cache: the shell's queries can win), so each page loads 3 times. */
const LOADS_PER_PAGE = 3
const PLACEHOLDER_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" fill="#ccc"/></svg>'

type Problem = { page: string; kind: string; text: string }

async function launch(): Promise<Browser> {
  try {
    return await chromium.launch()
  } catch {
    try {
      return await chromium.launch({ channel: 'chrome' })
    } catch {
      console.error('✖ No browser found. Install one with `npx playwright install chromium` (or install Google Chrome).')
      process.exit(1)
    }
  }
}

/**
 * The one message allowed through: Next's own dev-server notice when a route is rendered for a request carrying
 * `Cache-Control: no-cache`, which happens on each route's first on-demand compile in a freshly started `next dev`
 * (never on a warm dev server, and the code path doesn't exist in production builds). It is about Next's dev
 * tooling, not our pages; docs/decisions.md ("Hydration").
 */
const NEXT_DEV_CACHE_BYPASS = /^%c%s%c Route \S+ is rendering with server caches disabled\./

async function signInWithForm(page: Page): Promise<void> {
  await page.getByLabel(/email/i).fill(RECRUITER.globex)
  await page.getByLabel(/password/i).fill(PASSWORD)
  await page.getByRole('button', { name: /sign in/i }).click()
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30_000 })
  await page.waitForTimeout(SETTLE_MS)
}

function watch(page: Page, problems: Problem[], current: () => string): void {
  page.on('console', (m: ConsoleMessage) => {
    if (m.type() === 'warning' && NEXT_DEV_CACHE_BYPASS.test(m.text())) return
    if (m.type() === 'error' || m.type() === 'warning') {
      // "Failed to load resource" doesn't name the URL; the message location does.
      const url = m.location().url
      problems.push({ page: current(), kind: `console.${m.type()}`, text: url ? `${m.text()} @ ${url}` : m.text() })
    }
  })
  page.on('pageerror', (e) => problems.push({ page: current(), kind: 'pageerror', text: e.message }))
}

async function main(): Promise<void> {
  await requireServer()
  const globex = await signIn(RECRUITER.globex)

  const problems = await withCompanyState('globex', 'paid', TAG, async () => {
    // ---- fixtures -------------------------------------------------------------------------------------------
    const search = await api<{ search_id: string; results: { id: string }[] }>(globex.token, 'POST', '/api/search', {
      brief: `${TAG} mobile engineers`,
      filters: { roles: ['Mobile Engineer'] },
    })
    if (search.status !== 200 || search.body.results.length === 0) {
      throw new Error(`fixture search failed: ${search.status} ${JSON.stringify(search.body)}`)
    }
    const personId = search.body.results[0].id
    const list = await api<{ id: string }>(globex.token, 'POST', '/api/shortlists', { name: TAG })
    if (list.status !== 201 && list.status !== 200) throw new Error(`fixture shortlist failed: ${list.status}`)
    await api(globex.token, 'POST', `/api/shortlists/${list.body.id}/people/${personId}`)
    const saved = await api<{ id: string }>(globex.token, 'POST', '/api/saved-briefs', {
      brief: `${TAG} saved`,
      filters: { roles: ['Mobile Engineer'] },
    })
    if (saved.status !== 201 && saved.status !== 200) throw new Error(`fixture saved search failed: ${saved.status}`)

    const browser = await launch()
    const found: Problem[] = []
    try {
      const context = await browser.newContext()
      // Avatars and logos come from rotto.com, which rate-limits (429) and blocks headless Chrome (403). This check
      // is about our pages, so those requests get a local placeholder instead of hitting the third-party host.
      await context.route(/^https:\/\/(www\.)?rotto\.com\//, (route) =>
        route.fulfill({ status: 200, contentType: 'image/svg+xml', body: PLACEHOLDER_SVG }),
      )
      const page = await context.newPage()
      let current = 'start'
      watch(page, found, () => current)

      // ---- signed out: the login page, then sign in through the form ---------------------------------------
      current = '/login'
      await page.goto(`${API_BASE}/login`)
      await page.waitForTimeout(SETTLE_MS)
      current = '/login (sign in)'
      await signInWithForm(page)

      // ---- signed in: every page, a full load then two reloads (cold, then warm HTTP cache) ---------------
      const s = search.body.search_id
      const paths = [
        '/search',
        `/search?s=${s}`,
        `/search?s=${s}&p=${personId}`,
        '/shortlists',
        `/shortlists/${list.body.id}`,
        '/saved',
      ]
      for (const path of paths) {
        for (let load = 1; load <= LOADS_PER_PAGE; load++) {
          current = `${path} (load ${load})`
          const res = load === 1 ? await page.goto(API_BASE + path) : await page.reload()
          if (!res || res.status() >= 400) found.push({ page: current, kind: 'http', text: `status ${res?.status()}` })
          await page.waitForLoadState('networkidle')
          await page.waitForTimeout(SETTLE_MS)
        }
      }

      // ---- sign out and back in (the shell's nav links re-prefetch while signed out) ------------------------
      current = 'sign out'
      await page.getByRole('button', { name: /account menu/i }).first().click()
      await page.getByRole('menuitem', { name: /sign out/i }).click()
      await page.waitForURL((u) => u.pathname.startsWith('/login'), { timeout: 30_000 })
      await page.waitForTimeout(SETTLE_MS)
      current = 'sign in again'
      await signInWithForm(page)
      await context.close()
    } finally {
      await browser.close()
      await api(globex.token, 'DELETE', `/api/shortlists/${list.body.id}`)
      await api(globex.token, 'DELETE', `/api/saved-briefs/${saved.body.id}`)
    }
    return found
  })

  if (problems.length === 0) {
    console.log(`PASS  every page hydrated with no console errors or warnings (${API_BASE})`)
    process.exit(0)
  }
  for (const p of problems) console.log(`FAIL  ${p.page.padEnd(60)} ${p.kind}: ${p.text.split('\n')[0].slice(0, 200)}`)
  process.exit(1)
}

main().catch((error: unknown) => {
  console.error('✖ check:hydration crashed:', error instanceof Error ? error.message : error)
  process.exit(1)
})
