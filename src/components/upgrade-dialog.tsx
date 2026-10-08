"use client"

import { CheckIcon } from "lucide-react"
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

const COPY = {
  quota: {
    title: "You've used your free search",
    description:
      "The free plan includes one search per company. Results you already have, shortlists and saved searches stay available.",
  },
  manual: {
    title: "Upgrade to Pro",
    description: "The free plan includes one search per company. Pro removes the limit.",
  },
} as const

const BENEFITS = [
  "Unlimited searches and re-runs",
  "Edit filters and search again",
  "Re-run saved searches any time",
]

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

  const benefits = (
    <ul className="space-y-2.5 text-base">
      {BENEFITS.map((b) => (
        <li key={b} className="flex items-center gap-2.5">
          <CheckIcon aria-hidden className="size-4 text-primary" />
          {b}
        </li>
      ))}
    </ul>
  )
  const note = (
    <p className="text-sm text-muted-foreground">
      Pro means your company has an active Stripe subscription. There&apos;s no checkout in this demo: your plan
      switches to Pro here automatically once Stripe confirms the subscription to our billing webhook.
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
        <DialogContent className="gap-5 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl">{copy.title}</DialogTitle>
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
      <DrawerContent>
        <DrawerHeader className="text-left">
          <DrawerTitle className="text-xl">{copy.title}</DrawerTitle>
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
