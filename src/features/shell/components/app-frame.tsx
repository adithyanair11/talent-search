"use client"

import type { Route } from "next"
import { BookmarkIcon, HistoryIcon, RotateCwIcon, SearchIcon } from "lucide-react"
import dynamic from "next/dynamic"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Suspense } from "react"
import {
  AppShell,
  Brand,
  SidebarBody,
  SidebarFooter,
  SidebarHeader,
  SidebarItem,
  SidebarSection,
  TabBarItem,
} from "@/components/app-shell"
import { PlanBadge } from "@/components/plan-badge"
import { ThemeToggle } from "@/components/theme-toggle"
import { usePlan } from "@/features/plan/hooks"
import { useUpgradeStore } from "@/features/plan/store"
import { SavedSearchesSidebar } from "@/features/saved-briefs/components/saved-searches-sidebar"

const UpgradeDialog = dynamic(() => import("@/components/upgrade-dialog").then((m) => m.UpgradeDialog), {
  ssr: false,
})

const NAV: { href: Route; label: string; short: string; icon: React.ReactNode }[] = [
  { href: "/search", label: "Search", short: "Search", icon: <SearchIcon aria-hidden /> },
  { href: "/shortlists", label: "Shortlists", short: "Shortlists", icon: <BookmarkIcon aria-hidden /> },
  { href: "/saved", label: "Saved searches", short: "Saved", icon: <HistoryIcon aria-hidden /> },
]

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`)
}

/**
 * Nav links with the current one marked. The pathname of a dynamic route (/shortlists/[id]) is runtime data,
 * so the links prerender un-highlighted (the Suspense fallback) and the active state streams in.
 */
function Nav({ kind }: { kind: "sidebar" | "tabs" }) {
  return (
    <Suspense fallback={<NavLinks kind={kind} pathname={null} />}>
      <CurrentNav kind={kind} />
    </Suspense>
  )
}

function CurrentNav({ kind }: { kind: "sidebar" | "tabs" }) {
  return <NavLinks kind={kind} pathname={usePathname()} />
}

function NavLinks({ kind, pathname }: { kind: "sidebar" | "tabs"; pathname: string | null }) {
  return NAV.map((item) => {
    const active = pathname !== null && isActive(pathname, item.href)
    return kind === "sidebar" ? (
      <SidebarItem key={item.href} asChild active={active}>
        <Link href={item.href}>
          {item.icon}
          <span className="min-w-0 truncate">{item.label}</span>
        </Link>
      </SidebarItem>
    ) : (
      <TabBarItem key={item.href} asChild active={active}>
        <Link href={item.href}>
          {item.icon}
          <span>{item.short}</span>
        </Link>
      </TabBarItem>
    )
  })
}

/** Plan badge wired to GET /api/plan, with loading (skeleton) and error (retry) states. */
function Plan() {
  const { data, isError, refetch, isFetching } = usePlan()
  const openUpgrade = useUpgradeStore((s) => s.open)

  if (isError && !data) {
    return (
      <button
        type="button"
        onClick={() => refetch()}
        disabled={isFetching}
        className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border px-3 text-xs font-medium whitespace-nowrap text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <RotateCwIcon aria-hidden className={isFetching ? "size-3 animate-spin" : "size-3"} />
        Plan unavailable · Retry
      </button>
    )
  }
  return <PlanBadge plan={data} onClick={() => openUpgrade("manual")} />
}

function Upgrade() {
  const reason = useUpgradeStore((s) => s.reason)
  const close = useUpgradeStore((s) => s.close)
  if (!reason) return null
  return <UpgradeDialog open onOpenChange={(open) => !open && close()} reason={reason} />
}

/**
 * The signed-in app frame. `account` is the server-rendered company/account menu (streamed in behind
 * Suspense because it reads the session); it sits at the foot of the sidebar and on the left of the mobile top bar.
 */
export function AppFrame({ account, children }: { account: React.ReactNode; children: React.ReactNode }) {
  return (
    <>
      <AppShell
        sidebar={
          <>
            <SidebarHeader>
              <Brand />
            </SidebarHeader>
            <SidebarBody>
              <SidebarSection>
                <Nav kind="sidebar" />
              </SidebarSection>
              <SavedSearchesSidebar />
            </SidebarBody>
            <SidebarFooter>
              <div className="flex w-full min-w-0 flex-col gap-3">
                <div className="flex items-center justify-between gap-2">
                  <Plan />
                  <ThemeToggle />
                </div>
                <div className="border-t border-sidebar-border pt-3">{account}</div>
              </div>
            </SidebarFooter>
          </>
        }
        topBarStart={account}
        topBarEnd={
          <div className="flex shrink-0 items-center gap-1">
            <Plan />
            <ThemeToggle />
          </div>
        }
        tabBar={<Nav kind="tabs" />}
      >
        {children}
      </AppShell>
      <Upgrade />
    </>
  )
}
