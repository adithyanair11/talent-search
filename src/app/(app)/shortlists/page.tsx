import type { Metadata } from "next"
import { BookmarkIcon } from "lucide-react"
import Link from "next/link"
import { EmptyState } from "@/components/empty-state"
import { Button } from "@/components/ui/button"

export const metadata: Metadata = { title: "Shortlists · Talent Search" }

export default function ShortlistsPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 md:py-10">
      <h1 className="text-2xl font-semibold">Shortlists</h1>
      <EmptyState
        icon={BookmarkIcon}
        title="No shortlists yet"
        description="Shortlist candidates from your search results to keep track of them here."
        action={
          <Button asChild variant="outline">
            <Link href="/search">Find candidates</Link>
          </Button>
        }
      />
    </div>
  )
}
