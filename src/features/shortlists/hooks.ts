"use client"

import { type QueryClient, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast, toastUndo } from "@/components/toast"
import type { ShortlistDetail, ShortlistSummary } from "@/lib/schemas/shortlists"
import {
  addToShortlist,
  createShortlist,
  deleteShortlist,
  fetchShortlist,
  fetchShortlists,
  removeFromShortlist,
  renameShortlist,
} from "./api"
import { type MemberRef, prependList, removeList, removeMember, renameList, setMember, shortlistedIds } from "./cache"

export const shortlistKeys = {
  all: ["shortlists"] as const,
  list: () => ["shortlists", "list"] as const,
  detail: (id: string) => ["shortlists", "detail", id] as const,
}

const listQuery = {
  queryKey: shortlistKeys.list(),
  queryFn: ({ signal }: { signal: AbortSignal }) => fetchShortlists(signal).then((r) => r.shortlists),
}

/** GET /api/shortlists: the company's lists with counts, avatars and member ids. */
export function useShortlists() {
  return useQuery(listQuery)
}

const NONE: ReadonlySet<string> = new Set()

/** Everyone on at least one list. One subscription per list view; rows get a plain boolean. */
export function useShortlistedIds(): ReadonlySet<string> {
  return useQuery({ ...listQuery, select: shortlistedIds }).data ?? NONE
}

/** GET /api/shortlists/{id}: the list and its people. */
export function useShortlist(id: string) {
  return useQuery({
    queryKey: shortlistKeys.detail(id),
    queryFn: ({ signal }) => fetchShortlist(id, signal),
  })
}

type Snapshot = { lists?: ShortlistSummary[]; detail?: ShortlistDetail }

async function snapshot(qc: QueryClient, listId?: string): Promise<Snapshot> {
  await qc.cancelQueries({ queryKey: shortlistKeys.list() })
  if (listId) await qc.cancelQueries({ queryKey: shortlistKeys.detail(listId) })
  return {
    lists: qc.getQueryData<ShortlistSummary[]>(shortlistKeys.list()),
    detail: listId ? qc.getQueryData<ShortlistDetail>(shortlistKeys.detail(listId)) : undefined,
  }
}

function restore(qc: QueryClient, snap: Snapshot | undefined, listId?: string) {
  if (snap?.lists) qc.setQueryData(shortlistKeys.list(), snap.lists)
  if (listId && snap?.detail) qc.setQueryData(shortlistKeys.detail(listId), snap.detail)
}

function updateLists(qc: QueryClient, update: (lists: ShortlistSummary[]) => ShortlistSummary[]) {
  qc.setQueryData<ShortlistSummary[]>(shortlistKeys.list(), (lists) => (lists ? update(lists) : lists))
}

export type MembershipChange = {
  list: { id: string; name: string }
  person: MemberRef & { full_name: string }
  on: boolean
  /** Undo of a previous change: no toast of its own. */
  silent?: boolean
}

/**
 * Add / remove one person on one list, optimistically: the bookmark and checkbox flip at once, roll back with
 * an error toast if the server refuses, and a success toast offers Undo ("Added to Frontend Q4 · Undo").
 * The callbacks live on the mutation, so Undo still works after the row or menu that started it unmounted.
 */
export function useSetMembership() {
  const qc = useQueryClient()
  const mutation = useMutation({
    mutationFn: ({ list, person, on }: MembershipChange) =>
      on ? addToShortlist(list.id, person.id) : removeFromShortlist(list.id, person.id),
    onMutate: async ({ list, person, on }) => {
      const snap = await snapshot(qc, list.id)
      updateLists(qc, (lists) => setMember(lists, list.id, person, on))
      if (!on && snap.detail) qc.setQueryData(shortlistKeys.detail(list.id), removeMember(snap.detail, person.id))
      return snap
    },
    onError: (_err, { list, person, on }, snap) => {
      restore(qc, snap, list.id)
      toast.error(
        on
          ? `Couldn't add ${person.full_name} to ${list.name}. Try again.`
          : `Couldn't remove ${person.full_name} from ${list.name}. Try again.`,
      )
    },
    onSuccess: (_data, change) => {
      if (change.silent) return
      const undo = () => mutation.mutate({ ...change, on: !change.on, silent: true })
      toastUndo(change.on ? `Added to ${change.list.name}` : `Removed from ${change.list.name}`, undo)
    },
    onSettled: (_data, _err, { list }) => {
      void qc.invalidateQueries({ queryKey: shortlistKeys.list() })
      void qc.invalidateQueries({ queryKey: shortlistKeys.detail(list.id) })
    },
  })
  return mutation.mutate
}

/** POST /api/shortlists. Errors (409 duplicate, 400 invalid) are shown inline by the caller. */
export function useCreateShortlist() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (name: string) => createShortlist(name).then(({ id }) => ({ id, name: name.trim() })),
    onSuccess: ({ id, name }) => {
      updateLists(qc, (lists) => prependList(lists, id, name))
      void qc.invalidateQueries({ queryKey: shortlistKeys.list() })
    },
  })
}

/** PATCH /api/shortlists/{id}, optimistic. Errors roll back and are shown inline by the caller. */
export function useRenameShortlist() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => renameShortlist(id, name),
    onMutate: async ({ id, name }) => {
      const snap = await snapshot(qc, id)
      updateLists(qc, (lists) => renameList(lists, id, name.trim()))
      if (snap.detail) qc.setQueryData(shortlistKeys.detail(id), { ...snap.detail, name: name.trim() })
      return snap
    },
    onError: (_err, { id }, snap) => restore(qc, snap, id),
    onSettled: (_data, _err, { id }) => {
      void qc.invalidateQueries({ queryKey: shortlistKeys.list() })
      void qc.invalidateQueries({ queryKey: shortlistKeys.detail(id) })
    },
  })
}

/**
 * Re-create a deleted list with the same name and members (oldest first, so "most recently added" order is
 * kept). It gets a new id: links to the old list stop working.
 */
async function recreate(list: ShortlistSummary): Promise<void> {
  const { id } = await createShortlist(list.name)
  for (const personId of [...list.person_ids].reverse()) await addToShortlist(id, personId)
}

/** DELETE /api/shortlists/{id}, optimistic, with an Undo toast that restores the list. */
export function useDeleteShortlist() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (list: ShortlistSummary) => deleteShortlist(list.id),
    onMutate: async (list) => {
      const snap = await snapshot(qc)
      updateLists(qc, (lists) => removeList(lists, list.id))
      return snap
    },
    onError: (_err, list, snap) => {
      restore(qc, snap)
      toast.error(`Couldn't delete ${list.name}. Try again.`)
    },
    onSuccess: (_data, list) => {
      qc.removeQueries({ queryKey: shortlistKeys.detail(list.id) })
      toastUndo(`Deleted ${list.name}`, () => {
        recreate(list)
          .then(() => toast.success(`Restored ${list.name}`))
          .catch(() => toast.error(`Couldn't restore ${list.name}. Try again.`))
          .finally(() => void qc.invalidateQueries({ queryKey: shortlistKeys.list() }))
      })
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: shortlistKeys.list() }),
  }).mutate
}
