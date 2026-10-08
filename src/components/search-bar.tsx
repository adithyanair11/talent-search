"use client"

import { ArrowUpIcon, Loader2Icon, SearchIcon } from "lucide-react"
import { useEffect, useId, useLayoutEffect, useRef } from "react"
import { Kbd } from "@/components/kbd"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export const BRIEF_MAX_LENGTH = 500

type SearchBarProps = {
  value: string
  onChange: (value: string) => void
  onSubmit: (value: string) => void
  loading?: boolean
  disabled?: boolean
  /** Inline validation / request error shown under the field. */
  error?: string | null
  placeholder?: string
  autoFocus?: boolean
  /** Register ⌘K / Ctrl+K and `/` to focus. Only one SearchBar per page should own the shortcut. */
  globalShortcut?: boolean
  className?: string
}

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false
  return el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName)
}

/**
 * The primary input: a large, auto-growing brief field. Enter submits, Shift+Enter inserts a newline.
 * Controlled — the owner holds the value and runs the search.
 */
export function SearchBar({
  value,
  onChange,
  onSubmit,
  loading = false,
  disabled = false,
  error,
  placeholder = "Describe who you're looking for — e.g. senior React engineers in NYC",
  autoFocus = false,
  globalShortcut = true,
  className,
}: SearchBarProps) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const inputId = useId()
  const errorId = useId()
  const trimmed = value.trim()
  const tooLong = value.length > BRIEF_MAX_LENGTH
  const canSubmit = trimmed.length > 0 && !tooLong && !loading && !disabled
  const showCounter = value.length > BRIEF_MAX_LENGTH * 0.8

  // Auto-grow: reset then match content height (field-sizing isn't universal yet).
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
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

  return (
    <div className={cn("w-full", className)}>
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
        className={cn(
          "group/search relative flex items-start gap-3 rounded-xl border border-border bg-background px-4 py-3.5 transition-[border-color,box-shadow]",
          "hover:border-border-strong",
          "focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/12",
          error && "border-destructive focus-within:border-destructive focus-within:ring-destructive/12",
          disabled && "pointer-events-none opacity-60",
        )}
      >
        <SearchIcon aria-hidden className="mt-1 size-5 shrink-0 text-muted-foreground" />
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
          aria-invalid={Boolean(error) || tooLong || undefined}
          aria-describedby={error ? errorId : undefined}
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
            "max-h-60 min-h-7 flex-1 resize-none overflow-y-auto bg-transparent text-lg leading-7 outline-none placeholder:text-muted-foreground/80 sm:text-xl sm:leading-7",
            "focus-visible:outline-none",
          )}
        />
        <div className="flex shrink-0 items-center gap-2 self-end">
          {showCounter && (
            <span
              aria-live="polite"
              className={cn(
                "text-xs tabular-nums text-muted-foreground",
                tooLong && "text-destructive",
              )}
            >
              {value.length}/{BRIEF_MAX_LENGTH}
            </span>
          )}
          {!value && !loading && (
            <span className="hidden items-center gap-1 sm:flex" aria-hidden>
              <Kbd>⌘</Kbd>
              <Kbd>K</Kbd>
            </span>
          )}
          <Button
            type="submit"
            size="icon"
            disabled={!canSubmit}
            aria-label={loading ? "Searching" : "Search"}
            className={cn("size-9 rounded-lg max-sm:size-11", loading && "disabled:opacity-100")}
          >
            {loading ? <Loader2Icon className="animate-spin" /> : <ArrowUpIcon />}
          </Button>
        </div>
      </form>
      {(error || tooLong) && (
        <p id={errorId} role="alert" className="mt-2 px-1 text-sm text-destructive">
          {tooLong ? `Keep the brief under ${BRIEF_MAX_LENGTH} characters.` : error}
        </p>
      )}
    </div>
  )
}
