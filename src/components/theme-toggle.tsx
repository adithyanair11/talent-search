"use client"

import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import { useHydrated } from "@/hooks/use-hydrated"

const ORDER = ["system", "light", "dark"] as const

/** Cycles system → light → dark. Renders a neutral icon until mounted (theme is unknown on the server). */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const mounted = useHydrated()
  const current = mounted ? ((theme as (typeof ORDER)[number]) ?? "system") : "system"
  const next = ORDER[(ORDER.indexOf(current) + 1) % ORDER.length]
  const Icon = current === "light" ? SunIcon : current === "dark" ? MoonIcon : MonitorIcon

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={() => setTheme(next)}
      aria-label={`Theme: ${current}. Switch to ${next}`}
      title={`Theme: ${current}`}
    >
      <Icon />
    </Button>
  )
}
