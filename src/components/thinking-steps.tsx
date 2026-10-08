"use client"

import { CheckIcon } from "lucide-react"
import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"

export const THINKING_STEPS = [
  "Reading your brief",
  "Understanding filters",
  "Finding people",
  "Ranking",
] as const

/** Edited-filter runs skip the model, so they start at "Finding people". */
const FIRST_WITHOUT_MODEL = 2
/** When each step starts (ms after the run starts). The last step holds until the response lands. */
const STEP_AT_MS = [0, 700, 1500, 2300] as const

/**
 * Drives ThinkingSteps while a search runs. Presentational only: the search is one API call with no
 * streaming, so steps advance on a timer and the final one holds until `running` turns false
 * (docs/decisions.md). Returns the active step index, or `null` when idle.
 */
export function useThinkingSteps(running: boolean, usesModel: boolean): number | null {
  const first = usesModel ? 0 : FIRST_WITHOUT_MODEL
  // Only timers set this; the cleanup resets it, so a new run always starts at `first`.
  const [advanced, setAdvanced] = useState(0)

  useEffect(() => {
    if (!running) return
    const base = STEP_AT_MS[first]
    const timers = STEP_AT_MS.slice(first + 1).map((at, i) =>
      setTimeout(() => setAdvanced(first + 1 + i), at - base),
    )
    return () => {
      timers.forEach(clearTimeout)
      setAdvanced(0)
    }
  }, [running, first])

  return running ? Math.max(first, advanced) : null
}

/**
 * The AI "working" state: the pipeline steps in sequence. The active step shimmers with a pulsing dot,
 * finished steps get a check, upcoming ones are muted. Announced politely (one live region, the active label).
 */
export function ThinkingSteps({
  active,
  usesModel = true,
  className,
}: {
  /** Index into THINKING_STEPS. `THINKING_STEPS.length` = all done. */
  active: number
  /** Edited filters skip the model: the first two steps are not shown. */
  usesModel?: boolean
  className?: string
}) {
  const first = usesModel ? 0 : FIRST_WITHOUT_MODEL
  const steps = THINKING_STEPS.slice(first)
  const current = THINKING_STEPS[Math.min(active, THINKING_STEPS.length - 1)]

  return (
    <div className={cn("@container w-full", className)}>
      <p role="status" aria-live="polite" className="sr-only">
        {active >= THINKING_STEPS.length ? "Done" : `${current}…`}
      </p>
      {/* Vertical in narrow containers; one row once all four steps fit (container query, not viewport). */}
      <ol aria-hidden className="flex flex-col gap-2.5 @2xl:flex-row @2xl:items-center @2xl:gap-2">
        {steps.map((label, i) => {
          const index = first + i
          const state = index < active ? "done" : index === active ? "active" : "pending"
          return (
            <li key={label} className="flex items-center gap-2">
              {i > 0 && (
                <span
                  className={cn(
                    "hidden h-px w-6 transition-colors duration-250 @2xl:block",
                    state === "pending" ? "bg-border" : "bg-primary/40",
                  )}
                />
              )}
              <StepMark state={state} />
              <span
                className={cn(
                  "text-sm transition-colors duration-250",
                  state === "done" && "text-muted-foreground",
                  state === "active" && "text-shimmer font-medium",
                  state === "pending" && "text-muted-foreground/60",
                )}
              >
                {label}
              </span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

function StepMark({ state }: { state: "done" | "active" | "pending" }) {
  return (
    <span
      className={cn(
        "relative flex size-4 shrink-0 items-center justify-center rounded-full transition-colors duration-250",
        state === "done" && "bg-primary-subtle text-primary-subtle-foreground",
        state === "pending" && "border border-border-strong",
      )}
    >
      {state === "done" && <CheckIcon className="size-2.5 animate-chip-in" strokeWidth={3} />}
      {state === "active" && (
        <>
          <span className="absolute inset-0 rounded-full bg-[image:var(--accent-gradient)] opacity-20" />
          <span className="size-2 animate-pulse-dot rounded-full bg-[image:var(--accent-gradient)]" />
        </>
      )}
    </span>
  )
}

/** Card wrapper used on the results page while a search runs: steps above shaped placeholders. */
export function ThinkingPanel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("animate-fade-up rounded-2xl border border-border bg-card px-4 py-4 sm:px-5", className)}>
      {children}
    </div>
  )
}
