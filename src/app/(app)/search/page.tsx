import type { Metadata } from "next"
import { Suspense } from "react"
import { SearchPage } from "@/features/search/components/search-page"

export const metadata: Metadata = { title: "Search · Talent Search" }

/** The default page after sign-in. Reads `?s=<search_id>`, so it renders behind Suspense. */
export default function Page() {
  return (
    <Suspense>
      <SearchPage />
    </Suspense>
  )
}
