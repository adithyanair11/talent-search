"use client"

import { ChevronsUpDownIcon, Loader2Icon, LogOutIcon } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "@/components/toast"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import { preloadAuthClient, useSignOut } from "@/features/auth/hooks"
import { cn } from "@/lib/utils"

/** Company mark. Companies have no logo in the data, so it's a neutral monogram tile. */
function CompanyMark({ name, className }: { name: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid size-6 shrink-0 place-items-center rounded-md bg-foreground text-xs font-semibold text-background uppercase",
        className,
      )}
    >
      {name.trim().charAt(0)}
    </span>
  )
}

/** The signed-in company as a menu trigger: who you are, and the way out. */
export function AccountMenu({ companyName, email }: { companyName: string; email: string | null }) {
  const signOut = useSignOut()
  const [open, setOpen] = useState(false)

  // The menu stays open while signing out (to show the spinner). With cacheComponents the shell stays mounted,
  // hidden in <Activity>, and is shown again on the next sign-in, so close it and drop the finished sign-out when
  // it is hidden (effects are cleaned up then).
  const { reset } = signOut
  useEffect(
    () => () => {
      reset()
      setOpen(false)
    },
    [reset],
  )

  function onSignOut() {
    signOut.mutate(undefined, {
      onError: () => toast.error("Couldn't sign out. Try again."),
    })
  }

  return (
    <DropdownMenu
      open={open}
      onOpenChange={(next) => {
        // Sign out is in this menu: warm the lazily loaded auth client as it opens.
        if (next) preloadAuthClient()
        setOpen(next)
      }}
    >
      <DropdownMenuTrigger
        className={cn(
          "-ml-1 flex h-11 min-w-0 items-center gap-2 rounded-md px-1 text-left outline-none transition-colors md:h-9 md:w-full md:px-2",
          "hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/50 data-[state=open]:bg-accent",
        )}
        aria-label={`${companyName} account menu`}
      >
        <CompanyMark name={companyName} />
        <span className="min-w-0 truncate text-base font-semibold tracking-tight">{companyName}</span>
        <ChevronsUpDownIcon aria-hidden className="ml-auto size-3.5 shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-60">
        <DropdownMenuLabel className="font-normal">
          <span className="block text-xs text-muted-foreground">Signed in to {companyName} as</span>
          <span className="block truncate text-base">{email ?? "Recruiter"}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={(event) => {
            event.preventDefault()
            onSignOut()
          }}
          disabled={signOut.isPending}
          className="min-h-11 md:min-h-8"
        >
          {signOut.isPending ? <Loader2Icon aria-hidden className="animate-spin" /> : <LogOutIcon aria-hidden />}
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function AccountMenuSkeleton() {
  return (
    <span className="flex h-11 items-center gap-2 md:h-9 md:w-full md:px-1" aria-hidden>
      <Skeleton className="size-6 rounded-md" />
      <Skeleton className="h-4 w-20" />
    </span>
  )
}
