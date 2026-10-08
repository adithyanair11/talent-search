"use client"

import { PlusIcon } from "lucide-react"
import { useState } from "react"
import { CheckboxIndicator } from "@/components/checkbox-indicator"
import { ErrorState } from "@/components/error-state"
import { Button } from "@/components/ui/button"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { type MembershipChange, useCreateShortlist, useSetMembership, useShortlists } from "../hooks"
import { NameForm } from "./name-form"
import { ShortlistMenuSkeleton } from "./shortlist-menu-skeleton"

/**
 * The body of the shortlist menu: filter lists as you type (local, no network), tick to add / untick to
 * remove (optimistic, with an Undo toast), or create a list and add the person in one step.
 */
export function ShortlistMenuContent({
  person,
  autoFocus,
}: {
  person: MembershipChange["person"]
  autoFocus: boolean
}) {
  const lists = useShortlists()
  const setMembership = useSetMembership()
  const [query, setQuery] = useState("")
  const [creating, setCreating] = useState(false)

  const exact = lists.data?.some((l) => l.name.toLowerCase() === query.trim().toLowerCase()) ?? false

  return (
    <div className="flex flex-col">
      <Command loop>
        {lists.data && lists.data.length > 0 && (
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder="Find a list…"
            aria-label="Find a list"
            autoFocus={autoFocus}
            className="max-md:text-lg"
          />
        )}
        <CommandList className="max-h-64">
          {lists.isPending ? (
            <ShortlistMenuSkeleton />
          ) : lists.isError ? (
            <div className="p-2">
              <ErrorState
                variant="inline"
                message="Couldn't load your lists."
                onRetry={() => void lists.refetch()}
                retrying={lists.isFetching}
              />
            </div>
          ) : lists.data.length === 0 ? (
            <p className="px-3 py-4 text-sm text-muted-foreground">No lists yet. Create the first one below.</p>
          ) : (
            <>
              <CommandEmpty>No list matches “{query.trim()}”.</CommandEmpty>
              <CommandGroup>
                {lists.data.map((l) => {
                  const on = l.person_ids.includes(person.id)
                  return (
                    <CommandItem
                      key={l.id}
                      value={l.name}
                      aria-checked={on}
                      onSelect={() => setMembership({ list: l, person, on: !on })}
                      className="min-h-11 gap-2.5 rounded-lg md:min-h-9"
                    >
                      <CheckboxIndicator checked={on} />
                      <span className="min-w-0 flex-1 truncate">{l.name}</span>
                      <span className="text-xs text-muted-foreground tabular-nums">{l.count}</span>
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            </>
          )}
        </CommandList>
      </Command>
      <div className="border-t border-border p-1.5">
        {creating ? (
          <NewListForm
            initialName={exact ? "" : query.trim()}
            person={person}
            onDone={() => {
              setCreating(false)
              setQuery("")
            }}
          />
        ) : (
          <Button
            variant="ghost"
            className="w-full justify-start rounded-lg font-normal text-primary hover:text-primary max-md:h-11"
            onClick={() => setCreating(true)}
            disabled={!lists.data}
          >
            <PlusIcon />
            <span className="truncate">{query.trim() && !exact ? `New list “${query.trim()}”…` : "New list…"}</span>
          </Button>
        )}
      </div>
    </div>
  )
}

function NewListForm({
  initialName,
  person,
  onDone,
}: {
  initialName: string
  person: MembershipChange["person"]
  onDone: () => void
}) {
  const create = useCreateShortlist()
  const setMembership = useSetMembership()
  return (
    <NameForm
      initialName={initialName}
      submitLabel="Create"
      className="p-1"
      onCancel={onDone}
      onSubmit={async (name) => {
        const list = await create.mutateAsync(name)
        setMembership({ list, person, on: true })
        onDone()
      }}
    />
  )
}
