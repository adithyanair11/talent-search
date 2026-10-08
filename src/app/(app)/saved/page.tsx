import type { Metadata } from "next"
import { HistoryIcon } from "lucide-react"
import Link from "next/link"
import { EmptyState } from "@/components/empty-state"
import { Button } from "@/components/ui/button"

export const metadata: Metadata = { title: "Saved searches · Talent Search" }

export default function SavedSearchesPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 md:py-10">
      <h1 className="text-2xl font-semibold">Saved searches</h1>
      <EmptyState
        icon={HistoryIcon}
        title="No saved searches yet"
        description="Save a search to re-run it later with the same brief and filters."
        action={
          <Button asChild variant="outline">
            <Link href="/">Start a search</Link>
          </Button>
        }
      />
    </div>
  )
}
