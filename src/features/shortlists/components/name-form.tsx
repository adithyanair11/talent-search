"use client"

import { useId, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { SHORTLIST_NAME_MAX, shortlistNameSchema } from "@/lib/schemas/shortlists"
import { cn } from "@/lib/utils"
import { nameTaken } from "../cache"
import { useShortlists } from "../hooks"

/**
 * Inline name field for creating or renaming a list. Enter saves, Esc cancels. Checks length and duplicates
 * locally (same rules as the API), then shows the server's message for anything it still refuses.
 */
export function NameForm({
  initialName = "",
  exceptId,
  submitLabel,
  onSubmit,
  onCancel,
  saveOnBlur = false,
  className,
  inputClassName,
}: {
  initialName?: string
  /** The list being renamed: its own name isn't a duplicate. */
  exceptId?: string
  submitLabel?: string
  /** Resolves when saved; a rejection's message is shown under the field. */
  onSubmit: (name: string) => Promise<unknown>
  onCancel: () => void
  /** Rename: clicking away saves (or cancels when unchanged). */
  saveOnBlur?: boolean
  className?: string
  inputClassName?: string
}) {
  const lists = useShortlists()
  const [name, setName] = useState(initialName)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const errorId = useId()
  // Esc unmounts the field; a blur fired on the way out must not save what was just cancelled.
  const cancelled = useRef(false)

  const save = async () => {
    if (pending || cancelled.current) return
    const parsed = shortlistNameSchema.safeParse(name)
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? "Check the name.")
    // Renaming to the same name is a no-op, not an error.
    if (exceptId && parsed.data === initialName.trim()) return onCancel()
    if (nameTaken(lists.data ?? [], parsed.data, exceptId)) {
      return setError(`You already have a list called “${parsed.data}”. Pick another name.`)
    }
    setPending(true)
    try {
      await onSubmit(parsed.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save the name. Try again.")
      setPending(false)
    }
  }

  return (
    <form
      data-local-escape
      onSubmit={(e) => {
        e.preventDefault()
        void save()
      }}
      className={cn("space-y-1.5", className)}
    >
      <div className="flex gap-2">
        <Input
          autoFocus
          value={name}
          maxLength={SHORTLIST_NAME_MAX}
          disabled={pending}
          onChange={(e) => {
            setName(e.target.value)
            setError(null)
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault()
              cancelled.current = true
              onCancel()
            }
          }}
          onBlur={saveOnBlur && error === null ? () => void save() : undefined}
          onFocus={(e) => e.currentTarget.select()}
          placeholder="List name"
          aria-label="List name"
          aria-invalid={error !== null}
          aria-describedby={error ? errorId : undefined}
          className={cn("max-md:h-11", inputClassName)}
        />
        {submitLabel && (
          <Button type="submit" disabled={pending} className="max-md:h-11">
            {pending ? "Saving…" : submitLabel}
          </Button>
        )}
      </div>
      {error && (
        <p id={errorId} role="alert" className="px-0.5 text-xs text-destructive">
          {error}
        </p>
      )}
    </form>
  )
}
