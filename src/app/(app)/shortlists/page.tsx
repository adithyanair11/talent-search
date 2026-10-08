import type { Metadata } from "next"
import { ShortlistsPage } from "@/features/shortlists/components/shortlists-page"

export const metadata: Metadata = { title: "Shortlists · Talent Search" }

export default function Page() {
  return <ShortlistsPage />
}
