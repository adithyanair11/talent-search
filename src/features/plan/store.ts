"use client"

import { create } from "zustand"

type UpgradeReason = "quota" | "manual"

/** UI-only: whether the UpgradeDialog is open and why (badge click vs a 402 from search). */
export const useUpgradeStore = create<{
  reason: UpgradeReason | null
  open: (reason: UpgradeReason) => void
  close: () => void
}>()((set) => ({
  reason: null,
  open: (reason) => set({ reason }),
  close: () => set({ reason: null }),
}))
