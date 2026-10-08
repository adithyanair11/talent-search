"use client"

import { CheckIcon, SparklesIcon } from "lucide-react"
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

const COPY = {
  quota: {
    title: "You've used your free search",
    description:
      "The free plan includes one search per company. Editing filters or re-running a saved search counts as a new search. Your results, shortlists and saved searches stay available.",
  },
  manual: {
    title: "Upgrade to Pro",
    description:
      "The free plan includes one search per company. Editing filters or re-running a saved search counts as a new search.",
  },
} as const

const BENEFITS = ["Unlimited searches", "Edit filters and re-run saved searches as often as you like"]

/**
 * Explains the free limit (opened on a 402 or from PlanBadge). There is no checkout in this app:
 * the plan flips to paid when billing confirms via webhook, so the copy says exactly that.
 * Pass `action` to add a primary button when one exists.
 */
export function UpgradeDialog({
  open,
  onOpenChange,
  reason = "quota",
  action,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  reason?: keyof typeof COPY
  action?: React.ReactNode
}) {
  const isDesktop = useIsDesktop()
  const copy = COPY[reason]

  // Opened from a store (a 402, the plan badge), not a trigger: return focus to whatever opened it.
  const focusProps = useRestoreFocus()

  const mark = (
    <span
      aria-hidden
      className="mb-1 flex size-11 items-center justify-center rounded-full bg-[image:var(--accent-gradient)] text-primary-foreground shadow-[var(--glow)]"
    >
      <SparklesIcon className="size-5" />
    </span>
  )
  const benefits = (
    <ul className="space-y-2.5 rounded-xl border border-border bg-surface p-4 text-base">
      {BENEFITS.map((b) => (
        <li key={b} className="flex items-center gap-2.5">
          <span aria-hidden className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary-subtle text-primary-subtle-foreground">
            <CheckIcon className="size-3" strokeWidth={3} />
          </span>
          {b}
        </li>
      ))}
    </ul>
  )
  const note = (
    <p className="text-sm text-pretty text-muted-foreground">
      There&apos;s no checkout in this demo. Your plan switches to Pro on its own once Stripe tells our billing
      webhook that your company&apos;s subscription is active.
    </p>
  )
  const close = (
    <Button variant={action ? "ghost" : "outline"} onClick={() => onOpenChange(false)}>
      {action ? "Not now" : "Got it"}
    </Button>
  )

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="gap-5 sm:max-w-md" {...focusProps}>
          <DialogHeader>
            {mark}
            <DialogTitle className="text-xl font-semibold">{copy.title}</DialogTitle>
            <DialogDescription className="text-base">{copy.description}</DialogDescription>
          </DialogHeader>
          {benefits}
          {note}
          <DialogFooter>
            {close}
            {action}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent {...focusProps}>
        <DrawerHeader className="text-left group-data-[vaul-drawer-direction=bottom]/drawer-content:text-left">
          {mark}
          <DrawerTitle className="text-xl font-semibold">{copy.title}</DrawerTitle>
          <DrawerDescription className="text-base">{copy.description}</DrawerDescription>
        </DrawerHeader>
        <div className="space-y-4 px-4">
          {benefits}
          {note}
        </div>
        <DrawerFooter className="pb-[calc(1rem+env(safe-area-inset-bottom))]">
          {action}
          {close}
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
