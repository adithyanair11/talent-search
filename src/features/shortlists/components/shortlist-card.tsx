"use client"

import type { Route } from "next"
import { ArrowRightIcon, MoreHorizontalIcon, PencilIcon, Trash2Icon } from "lucide-react"
import dynamic from "next/dynamic"
import Link from "next/link"
import { memo, useRef, useState } from "react"
import { AvatarStack } from "@/components/avatar-stack"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import type { ShortlistSummary } from "@/lib/schemas/shortlists"
import { cn } from "@/lib/utils"
import { useRenameShortlist } from "../hooks"
import { NameForm } from "./name-form"

const ConfirmDialog = dynamic(() => import("@/components/confirm-dialog").then((m) => m.ConfirmDialog), {
  ssr: false,
})

export const formatPeople = (n: number) => `${n.toLocaleString()} ${n === 1 ? "person" : "people"}`

/**
 * One list on /shortlists: name, count and a stack of member avatars; the whole card opens the list.
 * The overflow menu renames inline or deletes (confirm, then an Undo toast). Memoised — pass a stable `onDelete`.
 */
export const ShortlistCard = memo(function ShortlistCard({
  list,
  onDelete,
}: {
  list: ShortlistSummary
  onDelete: (list: ShortlistSummary) => void
}) {
  const [renaming, setRenaming] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const rename = useRenameShortlist()
  // Closing the menu returns focus to its trigger, which would blur (and so end) the rename field.
  const keepFocus = useRef(false)
  const linkRef = useRef<HTMLAnchorElement>(null)
  // Enter / Esc unmount the field, which would drop focus to the page: put it back on the list's link. A blur-save
  // (clicking elsewhere) leaves focus where the click put it.
  const endRename = () => {
    setRenaming(false)
    requestAnimationFrame(() => {
      const active = document.activeElement
      if (!active || active === document.body) linkRef.current?.focus()
    })
  }

  return (
    <div
      className={cn(
        "group/list relative flex h-full flex-col rounded-xl border border-border bg-card p-4 transition-[border-color,box-shadow] duration-200 sm:p-5",
        "hover:border-border-strong hover:shadow-sm has-[a:focus-visible]:border-border-strong has-[a:focus-visible]:ring-[3px] has-[a:focus-visible]:ring-ring/40",
      )}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          {renaming ? (
            <NameForm
              initialName={list.name}
              exceptId={list.id}
              saveOnBlur
              onCancel={endRename}
              onSubmit={async (name) => {
                await rename.mutateAsync({ id: list.id, name })
                endRename()
              }}
              className="relative z-10"
            />
          ) : (
            <h2 className="truncate text-base font-semibold tracking-[-0.005em]">
              <Link
                ref={linkRef}
                href={`/shortlists/${list.id}` as Route}
                className="outline-none after:absolute after:inset-0 after:rounded-[inherit] after:content-['']"
              >
                {list.name}
              </Link>
            </h2>
          )}
          <p className="mt-1 text-sm text-muted-foreground tabular-nums">{formatPeople(list.count)}</p>
        </div>
        {/* Non-modal: a modal menu that opens a dialog can leave the page unclickable. */}
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="relative z-10 -mt-1.5 -mr-2 max-md:size-11"
              aria-label={`Actions for ${list.name}`}
            >
              <MoreHorizontalIcon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            onCloseAutoFocus={(e) => {
              if (keepFocus.current) e.preventDefault()
              keepFocus.current = false
            }}
          >
            <DropdownMenuItem onSelect={() => {
                keepFocus.current = true
                setRenaming(true)
              }} className="max-md:min-h-11">
              <PencilIcon /> Rename
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onSelect={() => setConfirming(true)} className="max-md:min-h-11">
              <Trash2Icon /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="mt-auto flex h-6 items-center justify-between gap-3 pt-5">
        {list.count > 0 ? (
          <AvatarStack urls={list.avatar_urls} total={list.count} />
        ) : (
          <span className="text-sm text-muted-foreground">No one yet</span>
        )}
        <ArrowRightIcon
          aria-hidden
          className="size-4 text-muted-foreground transition-transform duration-150 group-hover/list:translate-x-0.5 group-hover/list:text-foreground"
        />
      </div>
      {confirming && (
        <ConfirmDialog
          open={confirming}
          onOpenChange={setConfirming}
          title={`Delete “${list.name}”?`}
          description={
            list.count > 0
              ? `${formatPeople(list.count)} will be removed from this list. The candidates themselves aren't affected.`
              : "This list is empty."
          }
          confirmLabel="Delete list"
          onConfirm={() => onDelete(list)}
        />
      )}
    </div>
  )
})

export function ShortlistCardSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card p-4 sm:p-5" aria-hidden>
      <Skeleton className="h-4 w-36 rounded-full" />
      <Skeleton className="mt-2 h-3.5 w-16 rounded-full" />
      <div className="mt-5 flex -space-x-1.5">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="size-6 rounded-full ring-2 ring-card" />
        ))}
      </div>
    </div>
  )
}
