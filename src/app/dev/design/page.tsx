import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { Suspense } from "react"
import { DesignShowcase } from "./showcase"

// Hidden design-review page: not linked from any navigation and excluded from indexing.
export const metadata: Metadata = {
  title: "Design system · Talent Search",
  robots: { index: false, follow: false },
}

export default function DesignPage({ searchParams }: PageProps<"/dev/design">) {
  // A design-review tool for local development only: production (`next start`) answers 404.
  if (process.env.NODE_ENV !== "development") notFound()
  return (
    <Suspense>
      <Showcase searchParams={searchParams} />
    </Suspense>
  )
}

/** `?frame=1&theme=light|dark` renders the page bare in one theme (used by the 375px iframes). */
async function Showcase({ searchParams }: Pick<PageProps<"/dev/design">, "searchParams">) {
  const { frame, theme } = await searchParams
  return <DesignShowcase frame={frame === "1"} theme={theme === "dark" ? "dark" : "light"} />
}
