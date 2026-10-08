import type { Metadata } from "next"
import { Brand } from "@/components/app-shell"
import { LoginForm } from "@/features/auth/components/login-form"
import { LoginPreview } from "@/features/auth/components/login-preview"

export const metadata: Metadata = { title: "Sign in · Talent Search" }

export default function LoginPage() {
  return (
    <main className="flex flex-1 flex-col bg-background">
      <div className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-16 px-4 py-10 sm:px-6 sm:py-16 lg:grid-cols-[minmax(0,25rem)_minmax(0,1fr)] lg:px-10 xl:gap-24">
        <div className="mx-auto w-full max-w-[25rem] animate-fade-up">
          <Brand />
          <h1 className="mt-10 text-3xl font-medium sm:text-4xl">Welcome back</h1>
          <p className="mt-3 text-lg text-pretty text-muted-foreground">
            Sign in to find candidates from a plain-English brief.
          </p>
          <div className="mt-8 rounded-2xl border border-border bg-card p-5 shadow-composer sm:p-6">
            <LoginForm />
          </div>
        </div>
        <LoginPreview className="max-lg:hidden" />
      </div>
    </main>
  )
}
