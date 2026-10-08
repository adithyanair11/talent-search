"use client"

import { useRef } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"
import { useIsDesktop } from "@/hooks/use-media-query"
import { useRestoreFocus } from "@/hooks/use-restore-focus"

/**
 * Confirmation for a destructive action that is hard to take back (deleting a whole shortlist). A Dialog from
 * 768px up, a bottom Drawer below. Cancel is focused first, so Enter never destroys by accident.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: React.ReactNode
  confirmLabel: string
  onConfirm: () => void
}) {
  const isDesktop = useIsDesktop()
  const cancelRef = useRef<HTMLButtonElement>(null)
  // Opened from a menu item that is gone by now: focus goes back to the menu's trigger, or <main> if the row
  // itself was deleted.
  const focusProps = useRestoreFocus(cancelRef)
  const confirm = () => {
    onConfirm()
    onOpenChange(false)
  }
  const cancel = (
    <Button ref={cancelRef} variant="outline" onClick={() => onOpenChange(false)}>
      Cancel
    </Button>
  )
  const action = (
    <Button variant="destructive" onClick={confirm}>
      {confirmLabel}
    </Button>
  )

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent role="alertdialog" showCloseButton={false} className="gap-5 sm:max-w-sm" {...focusProps}>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            {cancel}
            {action}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent role="alertdialog" {...focusProps}>
        <DrawerHeader className="text-left group-data-[vaul-drawer-direction=bottom]/drawer-content:text-left">
          <DrawerTitle className="text-lg">{title}</DrawerTitle>
          <DrawerDescription className="text-base">{description}</DrawerDescription>
        </DrawerHeader>
        <DrawerFooter className="pb-[calc(1rem+env(safe-area-inset-bottom))]">
          {action}
          {cancel}
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
