import type { Metadata } from "next"
import { SavedSearchesPage } from "@/features/saved-briefs/components/saved-searches-page"

export const metadata: Metadata = { title: "Saved searches · Talent Search" }

export default function Page() {
  return <SavedSearchesPage />
}
