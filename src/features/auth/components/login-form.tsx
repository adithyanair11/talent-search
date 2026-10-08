"use client"

import type { Route } from "next"
import { CircleAlertIcon, Loader2Icon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useId, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from "../demo-accounts"
import { type SignInError, useSignIn } from "../hooks"

const MESSAGES: Record<SignInError, string> = {
  invalid_credentials: "That email and password don't match a recruiter account.",
  network: "Couldn't reach the sign-in service. Check that the app is running and try again.",
  unknown: "Sign-in failed for an unexpected reason. Try again.",
}

/** Only same-origin paths, never `//host` or `/\host` (open-redirect guard). */
function safeNext(): Route {
  const next = new URLSearchParams(window.location.search).get("next")
  return (next && /^\/(?![/\\])/.test(next) ? next : "/") as Route
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
            className="h-11 md:h-9"
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
            className="h-11 md:h-9"
          />
        </div>

        {error && (
          <p
            id={errorId}
            role="alert"
            className="flex items-start gap-2 rounded-md bg-destructive-subtle px-3 py-2 text-sm text-destructive"
          >
            <CircleAlertIcon aria-hidden className="mt-px size-4 shrink-0" />
            {error}
          </p>
        )}

        <Button ref={submitRef} type="submit" className="h-11 w-full md:h-9" disabled={pending}>
          {pending && <Loader2Icon aria-hidden className="animate-spin" />}
          {pending ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      <section aria-labelledby="demo-accounts" className="space-y-2">
        <div className="flex items-center gap-3">
          <span className="h-px flex-1 bg-border" />
          <h2 id="demo-accounts" className="text-xs font-medium text-muted-foreground">
            Demo accounts
          </h2>
          <span className="h-px flex-1 bg-border" />
        </div>
        <ul className="grid gap-2 sm:grid-cols-2">
          {DEMO_ACCOUNTS.map((account) => {
            const selected = email === account.email && password === DEMO_PASSWORD
            return (
              <li key={account.email}>
                <button
                  type="button"
                  onClick={() => fill(account.email)}
                  disabled={pending}
                  aria-pressed={selected}
                  className={cn(
                    "flex min-h-11 w-full flex-col items-start rounded-md border border-border px-3 py-2 text-left outline-none transition-colors",
                    "hover:border-border-strong hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50",
                    selected && "border-primary/40 bg-primary-subtle hover:bg-primary-subtle",
                  )}
                >
                  <span className="text-base font-medium">{account.company}</span>
                  <span className="max-w-full truncate text-sm text-muted-foreground">{account.email}</span>
                </button>
              </li>
            )
          })}
        </ul>
        <p className="text-sm text-muted-foreground">Fills the form with a seeded recruiter. Each company sees only its own data.</p>
      </section>
    </div>
  )
}
