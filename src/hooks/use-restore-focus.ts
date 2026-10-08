"use client"

import { useMemo, useRef } from "react"
import { MAIN_ID } from "@/components/app-shell"

/**
 * Focus handling for a Dialog / Drawer opened from state rather than a `DialogTrigger` (a 402, a menu item that
 * unmounts): Radix has no trigger to return focus to, so it falls to `<body>` and keyboard users lose their
 * place. Spread the result on `DialogContent` / `DrawerContent`. `initialFocus` replaces `autoFocus` (which would
 * move focus before the opener could be recorded).
 */
export function useRestoreFocus(initialFocus?: React.RefObject<HTMLElement | null>) {
  const returnTo = useRef<HTMLElement | null>(null)
  return useMemo(
    () => ({
      onOpenAutoFocus: (e: Event) => {
        returnTo.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
        if (initialFocus?.current) {
          e.preventDefault()
          initialFocus.current.focus()
        }
      },
      onCloseAutoFocus: (e: Event) => {
        const el = returnTo.current?.isConnected ? returnTo.current : document.getElementById(MAIN_ID)
        returnTo.current = null
        if (!el) return
        e.preventDefault()
        el.focus({ preventScroll: true })
      },
    }),
    [initialFocus],
  )
}
