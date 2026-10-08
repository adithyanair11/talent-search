"use client"

import type { Route } from "next"
import { BookmarkIcon, HistoryIcon, RotateCwIcon, SearchIcon } from "lucide-react"
import dynamic from "next/dynamic"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  AppShell,
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

const UpgradeDialog = dynamic(() => import("@/components/upgrade-dialog").then((m) => m.UpgradeDialog), {
  ssr: false,
})

const NAV: { href: Route; label: string; short: string; icon: React.ReactNode }[] = [
  { href: "/", label: "Search", short: "Search", icon: <SearchIcon aria-hidden /> },
  { href: "/shortlists", label: "Shortlists", short: "Shortlists", icon: <BookmarkIcon aria-hidden /> },
  { href: "/saved", label: "Saved searches", short: "Saved", icon: <HistoryIcon aria-hidden /> },
]

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`)
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
        className="inline-flex h-7 items-center gap-1.5 rounded-md border border-border px-2 text-xs font-medium whitespace-nowrap text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
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
 * Suspense because it reads the session); it appears in the sidebar header and the mobile top bar.
 */
export function AppFrame({ account, children }: { account: React.ReactNode; children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <>
      <AppShell
        sidebar={
          <>
            <SidebarHeader>{account}</SidebarHeader>
            <SidebarBody>
              <SidebarSection>
                {NAV.map((item) => (
                  <SidebarItem key={item.href} asChild active={isActive(pathname, item.href)}>
                    <Link href={item.href}>
                      {item.icon}
                      <span className="min-w-0 truncate">{item.label}</span>
                    </Link>
                  </SidebarItem>
                ))}
              </SidebarSection>
            </SidebarBody>
            <SidebarFooter>
              <Plan />
              <ThemeToggle />
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
        tabBar={NAV.map((item) => (
          <TabBarItem key={item.href} asChild active={isActive(pathname, item.href)}>
            <Link href={item.href}>
              {item.icon}
              <span>{item.short}</span>
            </Link>
          </TabBarItem>
        ))}
      >
        {children}
      </AppShell>
      <Upgrade />
    </>
  )
}
