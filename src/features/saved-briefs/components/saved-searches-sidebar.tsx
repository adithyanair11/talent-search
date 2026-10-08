"use client"

import { HistoryIcon, Loader2Icon } from "lucide-react"
import Link from "next/link"
import { SidebarItem, SidebarSection } from "@/components/app-shell"
import { ErrorState } from "@/components/error-state"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { useRunSavedSearch, useSavedBriefs } from "../hooks"

const SHOWN = 5

/** The most recent saved searches in the desktop sidebar; clicking one re-runs it. The full list is /saved. */
export function SavedSearchesSidebar() {
  const saved = useSavedBriefs()
  const { run, pendingId } = useRunSavedSearch()

  let items: React.ReactNode
  if (saved.isPending) {
    items = [0, 1, 2].map((i) => (
      <li key={i} className="flex h-8 items-center gap-2 px-2">
        <Skeleton className="size-4" />
        <Skeleton className={cn("h-3.5", i === 1 ? "w-24" : "w-32")} />
      </li>
    ))
  } else if (saved.isError) {
    items = (
      <li className="px-1">
        <ErrorState
          variant="inline"
          message="Couldn't load saved searches"
          onRetry={() => void saved.refetch()}
          retrying={saved.isFetching}
        />
      </li>
    )
  } else if (saved.data.length === 0) {
    items = <li className="px-2 py-1 text-sm text-muted-foreground">Save a search to re-run it later.</li>
  } else {
    items = (
      <>
        {saved.data.slice(0, SHOWN).map((s) => (
          <SidebarItem
            key={s.id}
            icon={pendingId === s.id ? <Loader2Icon className="animate-spin" /> : <HistoryIcon />}
            title={`Run: ${s.brief}`}
            disabled={pendingId !== null}
            onClick={() => run(s)}
          >
            {s.brief}
          </SidebarItem>
        ))}
        {saved.data.length > SHOWN && (
          <li>
            <Link
              href="/saved"
              className="flex h-8 items-center rounded-md px-2 text-sm text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring/50"
            >
              View all {saved.data.length}
            </Link>
          </li>
        )}
      </>
    )
  }

  return <SidebarSection title="Saved searches">{items}</SidebarSection>
}
