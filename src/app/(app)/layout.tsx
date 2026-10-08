import { redirect } from "next/navigation"
import { Suspense } from "react"
import { AccountMenu, AccountMenuSkeleton } from "@/features/shell/components/account-menu"
import { AppFrame } from "@/features/shell/components/app-frame"
import { getSessionContext } from "@/server/auth"

/** Reads the session, so it streams in behind Suspense while the rest of the frame renders. */
async function Account() {
  const ctx = await getSessionContext()
  // proxy.ts already redirects signed-out requests; this covers a session with no recruiter row.
  if (!ctx) redirect("/login")
  return <AccountMenu companyName={ctx.companyName} email={ctx.email} />
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppFrame
      account={
        <Suspense fallback={<AccountMenuSkeleton />}>
          <Account />
        </Suspense>
      }
    >
      {children}
    </AppFrame>
  )
}
