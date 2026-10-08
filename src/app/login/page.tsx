import type { Metadata } from "next"
import { Brand } from "@/components/app-shell"
import { LoginForm } from "@/features/auth/components/login-form"

export const metadata: Metadata = { title: "Sign in · Talent Search" }

export default function LoginPage() {
  return (
    <main className="flex flex-1 flex-col items-center bg-surface px-4 py-12 sm:justify-center sm:py-16">
      <div className="w-full max-w-sm">
        <Brand className="mb-8" />
        <div className="rounded-lg border border-border bg-background p-5 sm:p-6">
          <h1 className="text-xl font-semibold">Sign in</h1>
          <p className="mt-1 mb-6 text-sm text-muted-foreground">Use your recruiter account to search candidates.</p>
          <LoginForm />
        </div>
      </div>
    </main>
  )
}
