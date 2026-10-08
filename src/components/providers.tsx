"use client"

import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ThemeProvider } from "next-themes"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { ApiError } from "@/lib/api-client"

type Router = ReturnType<typeof useRouter>

function makeQueryClient(router: Router) {
  /** A 401 from our API means the session ended: send the recruiter back to sign in. */
  const onApiError = (error: unknown) => {
    if (error instanceof ApiError && error.status === 401 && window.location.pathname !== "/login") {
      const next = window.location.pathname + window.location.search
      router.replace(`/login?next=${encodeURIComponent(next)}`)
    }
  }
  return new QueryClient({
    queryCache: new QueryCache({ onError: onApiError }),
    mutationCache: new MutationCache({ onError: onApiError }),
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        // 4xx won't change on retry; network blips and 5xx get two more tries.
        retry: (failureCount, error) => !(error instanceof ApiError && error.isClientError) && failureCount < 2,
      },
      mutations: { retry: false },
    },
  })
}

/** App-wide client providers: React Query, theme (class strategy), tooltips, toasts. */
export function Providers({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [queryClient] = useState(() => makeQueryClient(router))
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
        <TooltipProvider delayDuration={300}>
          {children}
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  )
}
