"use client"

import type { Route } from "next"
import { ArrowRightIcon, CircleAlertIcon, Loader2Icon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useId, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from "../demo-accounts"
import { safeNextPath } from "../safe-next"
import { type SignInError, useSignIn } from "../hooks"

const MESSAGES: Record<SignInError, string> = {
  invalid_credentials: "That email and password don't match a recruiter account.",
  network: "Couldn't reach the sign-in service. Check that the app is running and try again.",
  unknown: "Sign-in failed for an unexpected reason. Try again.",
}

function safeNext(): Route {
  return safeNextPath(new URLSearchParams(window.location.search).get("next"), window.location.origin) as Route
}

export function LoginForm() {
  const router = useRouter()
  const signIn = useSignIn()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const submitRef = useRef<HTMLButtonElement>(null)
  const emailId = useId()
  const passwordId = useId()
  const errorId = useId()

  // With cacheComponents, Next keeps this route mounted (hidden in <Activity>) after we navigate away and shows the
  // same instance again on sign-out. Effects are cleaned up when it is hidden, so wipe the finished sign-in there;
  // otherwise the form comes back stuck on "Signing in…" with the previous password filled in.
  const { reset } = signIn
  useEffect(
    () => () => {
      reset()
      setPassword("")
    },
    [reset],
  )

  const error = signIn.error ? MESSAGES[signIn.error] : null
  const pending = signIn.isPending || signIn.isSuccess

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    signIn.mutate(
      { email: email.trim(), password },
      {
        onSuccess: () => {
          router.replace(safeNext())
          router.refresh()
        },
      },
    )
  }

  function fill(demoEmail: string) {
    setEmail(demoEmail)
    setPassword(DEMO_PASSWORD)
    signIn.reset()
    submitRef.current?.focus()
  }

  return (
    <div className="space-y-6">
      <form onSubmit={onSubmit} className="space-y-4" aria-describedby={error ? errorId : undefined}>
        <div className="space-y-1.5">
          <label htmlFor={emailId} className="text-sm font-medium">
            Email
          </label>
          <Input
            id={emailId}
            type="email"
            name="email"
            autoComplete="username"
            inputMode="email"
            required
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={signIn.error === "invalid_credentials" || undefined}
            className="h-11 md:text-base"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor={passwordId} className="text-sm font-medium">
            Password
          </label>
          <Input
            id={passwordId}
            type="password"
            name="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={signIn.error === "invalid_credentials" || undefined}
            className="h-11 md:text-base"
          />
        </div>

        {error && (
          <p
            id={errorId}
            role="alert"
            className="flex items-start gap-2 rounded-xl border border-destructive/15 bg-destructive-subtle px-3 py-2.5 text-sm text-destructive"
          >
            <CircleAlertIcon aria-hidden className="mt-px size-4 shrink-0" />
            {error}
          </p>
        )}

        <Button ref={submitRef} type="submit" size="lg" className="w-full" disabled={pending}>
          {pending && <Loader2Icon aria-hidden className="animate-spin" />}
          {pending ? "Signing in…" : "Sign in"}
          {!pending && <ArrowRightIcon aria-hidden />}
        </Button>
      </form>

      <section aria-labelledby="demo-accounts" className="space-y-3">
        <div className="flex items-center gap-3">
          <span className="h-px flex-1 bg-border" />
          <h2 id="demo-accounts" className="text-xs font-medium tracking-[0.06em] text-muted-foreground uppercase">
            Try a demo account
          </h2>
          <span className="h-px flex-1 bg-border" />
        </div>
        <ul className="grid gap-2">
          {DEMO_ACCOUNTS.map((account) => {
            const selected = email === account.email && password === DEMO_PASSWORD
            return (
              <li key={account.email}>
                <button
                  type="button"
                  onClick={() => fill(account.email)}
                  disabled={pending}
                  aria-pressed={selected}
                  aria-label={`Fill in the ${account.company} demo account (${account.email})`}
                  className={cn(
                    "flex min-h-14 w-full items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5 text-left outline-none transition-[border-color,box-shadow,background-color]",
                    "hover:border-border-strong hover:shadow-sm focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:opacity-50",
                    selected && "border-primary/40 bg-primary-subtle hover:border-primary/50",
                  )}
                >
                  <span
                    aria-hidden
                    className="grid size-8 shrink-0 place-items-center rounded-full bg-foreground text-sm font-semibold text-background"
                  >
                    {account.company.charAt(0)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-base font-semibold">{account.company}</span>
                    <span className="block truncate text-xs text-muted-foreground">{account.email}</span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
        <p className="text-sm text-pretty text-muted-foreground">
          One click fills the form. Each company only ever sees its own lists and searches.
        </p>
      </section>
    </div>
  )
}
