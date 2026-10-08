"use client"

import { ArrowUpIcon, Loader2Icon, type LucideIcon, SparklesIcon } from "lucide-react"
import { useEffect, useId, useLayoutEffect, useRef } from "react"
import { Kbd } from "@/components/kbd"
import { cn } from "@/lib/utils"

export const BRIEF_MAX_LENGTH = 500

export type ComposerSuggestion = { label: string; icon?: LucideIcon }

export type ComposerProps = {
  value: string
  onChange: (value: string) => void
  onSubmit: (value: string) => void
  /**
   * `hero`: the centred, first-visit composer (title, roomy box, suggestion pills).
   * `docked`: the compact bar at the top of the results, like a chat input after the first answer.
   */
  variant?: "hero" | "docked"
  loading?: boolean
  disabled?: boolean
  /** Inline validation / request error shown under the field. */
  error?: string | null
  placeholder?: string
  autoFocus?: boolean
  /** Register ⌘K / Ctrl+K and `/` to focus. Only one composer per page should own the shortcut. */
  globalShortcut?: boolean
  /** Hero only: heading and one-line sub-copy above the box. */
  title?: string
  description?: React.ReactNode
  /** Hero only: example briefs shown as pills under the box. */
  suggestions?: readonly ComposerSuggestion[]
  onSuggestion?: (brief: string) => void
  /** A quiet line under the box (e.g. the free-plan quota). Centred in the hero, right-aligned when docked. */
  meta?: React.ReactNode
  className?: string
}

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false
  return el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName)
}

/**
 * The brief input, styled like an LLM composer: a large rounded box with the send button inside, a soft
 * gradient border and glow on focus. Enter submits, Shift+Enter inserts a newline, Esc blurs.
 * Controlled — the owner holds the value and runs the search.
 */
export function Composer({
  value,
  onChange,
  onSubmit,
  variant = "docked",
  loading = false,
  disabled = false,
  error,
  placeholder = "Describe who you're looking for — e.g. senior React engineers in NYC",
  autoFocus = false,
  globalShortcut = true,
  title,
  description,
  suggestions,
  onSuggestion,
  meta,
  className,
}: ComposerProps) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const inputId = useId()
  const errorId = useId()
  const hero = variant === "hero"
  const trimmed = value.trim()
  const tooLong = value.length > BRIEF_MAX_LENGTH
  const ready = trimmed.length > 0 && !tooLong && !disabled
  const canSubmit = ready && !loading
  const showCounter = value.length > BRIEF_MAX_LENGTH * 0.8
  const invalid = Boolean(error) || tooLong

  // Auto-grow: reset then match content height (field-sizing isn't universal yet).
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    // Empty: the CSS min-height, so a long (or rotating) placeholder never changes the box's height.
    if (!value) {
      el.style.height = ""
      return
    }
    el.style.height = "auto"
    el.style.height = `${el.scrollHeight}px`
  }, [value])

  useEffect(() => {
    if (!globalShortcut) return
    function onKeyDown(e: KeyboardEvent) {
      const isCmdK = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k"
      const isSlash = e.key === "/" && !e.metaKey && !e.ctrlKey && !isTypingTarget(e.target)
      if (isCmdK || isSlash) {
        e.preventDefault()
        ref.current?.focus()
        ref.current?.select()
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [globalShortcut])

  function submit() {
    if (canSubmit) onSubmit(trimmed)
  }

  const counter = showCounter && (
    <span aria-live="polite" className={cn("text-xs tabular-nums text-muted-foreground", tooLong && "text-destructive")}>
      {value.length}/{BRIEF_MAX_LENGTH}
    </span>
  )

  const send = (
    <button
      type="submit"
      disabled={!canSubmit}
      aria-label={loading ? "Searching" : "Search"}
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-full transition-[background-color,color,transform,opacity] outline-none max-sm:size-11",
        "focus-visible:ring-[3px] focus-visible:ring-ring/40 active:scale-95",
        ready || loading
          ? "bg-[image:var(--accent-gradient)] text-primary-foreground shadow-[inset_0_1px_0_oklch(1_0_0/0.18)]"
          : "bg-muted text-muted-foreground",
        "disabled:active:scale-100",
      )}
    >
      {loading ? <Loader2Icon className="size-4 animate-spin" /> : <ArrowUpIcon className="size-4" strokeWidth={2.25} />}
    </button>
  )

  return (
    <div className={cn("w-full", hero && "flex flex-col items-center", className)}>
      {hero && (title || description) && (
        <div className="mb-8 max-w-xl animate-fade-up text-center">
          {title && <h1 className="text-3xl font-medium sm:text-4xl">{title}</h1>}
          {description && <p className="mt-3 text-lg text-pretty text-muted-foreground">{description}</p>}
        </div>
      )}

      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
        className={cn(
          "group/composer relative w-full border border-border bg-card shadow-composer transition-[box-shadow,border-color] duration-200",
          hero ? "rounded-2xl px-4 pt-4 pb-3 sm:px-5 sm:pt-5" : "flex items-end gap-2 rounded-2xl py-2 pr-2 pl-4 sm:pl-5",
          "hover:border-border-strong",
          invalid
            ? "border-destructive/60 hover:border-destructive/60 focus-within:shadow-[0_0_0_4px_var(--destructive-subtle)]"
            : "focus-within:border-gradient focus-within:shadow-[var(--glow)]",
          disabled && "pointer-events-none opacity-60",
        )}
      >
        <label htmlFor={inputId} className="sr-only">
          Search brief
        </label>
        <textarea
          ref={ref}
          id={inputId}
          rows={1}
          value={value}
          disabled={disabled}
          autoFocus={autoFocus}
          placeholder={placeholder}
          aria-invalid={invalid || undefined}
          aria-describedby={error || tooLong ? errorId : undefined}
          spellCheck={false}
          enterKeyHint="search"
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault()
              submit()
            }
            if (e.key === "Escape") ref.current?.blur()
          }}
          className={cn(
            "block w-full resize-none overflow-y-auto bg-transparent text-lg outline-none placeholder:text-muted-foreground/80 focus-visible:outline-none",
            hero ? "max-h-60 min-h-16 leading-7 sm:text-xl sm:leading-8" : "max-h-40 min-h-7 flex-1 self-center py-1.5 leading-7",
          )}
        />
        {hero ? (
          <div className="mt-2 flex items-center justify-between gap-3">
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground pointer-coarse:invisible" aria-hidden>
              <Kbd>↵</Kbd> to search
              <span className="mx-1 text-border-strong">·</span>
              <Kbd>⇧</Kbd>
              <Kbd>↵</Kbd> new line
            </span>
            <span className="flex items-center gap-3">
              {counter}
              {send}
            </span>
          </div>
        ) : (
          <span className="flex shrink-0 items-center gap-2">
            {counter}
            {!value && !loading && (
              <span className="hidden items-center gap-1 sm:flex" aria-hidden>
                <Kbd>⌘</Kbd>
                <Kbd>K</Kbd>
              </span>
            )}
            {send}
          </span>
        )}
      </form>

      {(error || tooLong) && (
        <p id={errorId} role="alert" className={cn("mt-2 px-1 text-sm text-destructive", hero && "self-start")}>
          {tooLong ? `Keep the brief under ${BRIEF_MAX_LENGTH} characters.` : error}
        </p>
      )}

      {meta && <div className={cn("mt-2.5 flex min-h-5 w-full items-center", hero ? "justify-center" : "justify-end px-1")}>{meta}</div>}

      {hero && suggestions && suggestions.length > 0 && (
        <ul aria-label="Example briefs" className="mt-6 flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:justify-center">
          {suggestions.map((s, i) => {
            const Icon = s.icon ?? SparklesIcon
            return (
              <li key={s.label} className="animate-fade-up" style={{ animationDelay: `${120 + i * 60}ms` }}>
                <button
                  type="button"
                  disabled={disabled || loading}
                  onClick={() => onSuggestion?.(s.label)}
                  className={cn(
                    "flex min-h-11 w-full items-center gap-2.5 rounded-2xl border border-border bg-card py-1.5 pr-4 pl-1.5 sm:rounded-full text-left text-base transition-[border-color,box-shadow,transform] outline-none sm:min-h-10 sm:w-auto",
                    "hover:-translate-y-px hover:border-border-strong hover:shadow-sm focus-visible:ring-[3px] focus-visible:ring-ring/40",
                    "disabled:pointer-events-none disabled:opacity-50",
                  )}
                >
                  <span aria-hidden className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary-subtle text-primary-subtle-foreground">
                    <Icon className="size-3.5" />
                  </span>
                  <span className="min-w-0 text-pretty">{s.label}</span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
