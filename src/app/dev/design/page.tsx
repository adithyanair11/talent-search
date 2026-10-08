import type { Metadata } from "next"
import { DesignShowcase } from "./showcase"

// Hidden design-review page: not linked from any navigation and excluded from indexing.
export const metadata: Metadata = {
  title: "Design system · Talent Search",
  robots: { index: false, follow: false },
}

export default function DesignPage() {
  return <DesignShowcase />
}
