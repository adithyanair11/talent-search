import type { Metadata } from "next"
import { Suspense } from "react"
import { ShortlistDetailPage } from "@/features/shortlists/components/shortlist-detail-page"

export const metadata: Metadata = { title: "Shortlist · Talent Search" }

async function Detail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <ShortlistDetailPage id={id} />
}

/** Reads the dynamic `[id]` and `?p=<candidate>`, so it renders behind Suspense. */
export default function Page({ params }: PageProps<"/shortlists/[id]">) {
  return (
    <Suspense>
      <Detail params={params} />
    </Suspense>
  )
}
