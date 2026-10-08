"use client"

import { toast } from "sonner"

export { toast }

/**
 * Toast for a destructive action that already happened optimistically (remove from shortlist,
 * delete a saved search…). Undo reverts it; the toast stays 6 s so there is time to react.
 */
export function toastUndo(message: string, onUndo: () => void, description?: string) {
  return toast(message, {
    description,
    duration: 6000,
    action: { label: "Undo", onClick: onUndo },
  })
}
