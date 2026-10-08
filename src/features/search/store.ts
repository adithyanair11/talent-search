"use client"

import { create } from "zustand"
import type { ConstraintKey } from "./filter-model"

/** UI-only search state. Server data (results, filters, plan) lives in React Query. */
export const useSearchUiStore = create<{
  /** Which filter chip's editor popover is open. */
  openChip: ConstraintKey | null
  /** The filter the recruiter changed last — named in the zero-results state. */
  lastEdited: ConstraintKey | null
  setOpenChip: (key: ConstraintKey | null) => void
  setLastEdited: (key: ConstraintKey | null) => void
}>()((set) => ({
  openChip: null,
  lastEdited: null,
  setOpenChip: (openChip) => set({ openChip }),
  setLastEdited: (lastEdited) => set({ lastEdited }),
}))
