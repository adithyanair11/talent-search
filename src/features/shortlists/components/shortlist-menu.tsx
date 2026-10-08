"use client"

import { BookmarkCheckIcon, BookmarkIcon } from "lucide-react"
import dynamic from "next/dynamic"
import { useState } from "react"
import { ShortlistIconButton } from "@/components/candidate-row"
import { Button } from "@/components/ui/button"
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useIsDesktop } from "@/hooks/use-media-query"
import type { CandidateSummary } from "@/lib/candidate"
import type { MembershipChange } from "../hooks"
import { ShortlistMenuSkeleton } from "./shortlist-menu-skeleton"

// Search, list and create only matter once the menu opens: its chunk loads then (or on trigger hover).
const loadContent = () => import("./shortlist-menu-content")
const ShortlistMenuContent = dynamic(() => loadContent().then((m) => m.ShortlistMenuContent), {
  ssr: false,
  loading: () => <ShortlistMenuSkeleton />,
})

/** Esc inside the inline "New list…" form cancels the form, not the whole menu. */
function keepOpenOnLocalEscape(e: KeyboardEvent) {
  if (e.target instanceof Element && e.target.closest("[data-local-escape]")) e.preventDefault()
}

/**
 * "Shortlist" control for one candidate: a checkbox menu of the company's lists with search-as-you-type and
 * inline "New list…". A Popover from 768px up, a bottom Drawer below. `icon` is the row bookmark (filled when
 * the person is on any list); `button` is the sheet's primary action.
 */
export function ShortlistMenu({
  person,
  shortlisted,
  variant,
  nested = false,
}: {
  person: MembershipChange["person"]
  shortlisted: boolean
  variant: "icon" | "button"
  /** Opened from inside another drawer (the candidate sheet on mobile). */
  nested?: boolean
}) {
  const [open, setOpen] = useState(false)
  const isDesktop = useIsDesktop()

  const trigger =
    variant === "icon" ? (
      <ShortlistIconButton name={person.full_name} shortlisted={shortlisted} onPointerEnter={() => void loadContent()} />
    ) : (
      <Button onPointerEnter={() => void loadContent()} aria-pressed={shortlisted}>
        {shortlisted ? <BookmarkCheckIcon /> : <BookmarkIcon />}
        {shortlisted ? "Shortlisted" : "Shortlist"}
      </Button>
    )
  const content = open && <ShortlistMenuContent person={person} autoFocus={isDesktop} />

  if (isDesktop) {
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>{trigger}</PopoverTrigger>
        <PopoverContent
          align={variant === "icon" ? "end" : "start"}
          collisionPadding={16}
          className="w-72 p-0"
          aria-label={`Shortlists for ${person.full_name}`}
          onEscapeKeyDown={keepOpenOnLocalEscape}
        >
          {content}
        </PopoverContent>
      </Popover>
    )
  }

  return (
    <Drawer open={open} onOpenChange={setOpen} nested={nested}>
      <DrawerTrigger asChild>{trigger}</DrawerTrigger>
      <DrawerContent onEscapeKeyDown={keepOpenOnLocalEscape}>
        <DrawerHeader className="text-left group-data-[vaul-drawer-direction=bottom]/drawer-content:text-left">
          <DrawerTitle className="text-lg">Shortlist {person.full_name}</DrawerTitle>
          <DrawerDescription>Tick the lists they belong on.</DrawerDescription>
        </DrawerHeader>
        <div className="px-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">{content}</div>
      </DrawerContent>
    </Drawer>
  )
}

/** Stable render prop for `CandidateRow` (module level, so memoised rows don't re-render). */
export function renderShortlistMenu(candidate: CandidateSummary, shortlisted: boolean) {
  return <ShortlistMenu person={candidate} shortlisted={shortlisted} variant="icon" />
}
