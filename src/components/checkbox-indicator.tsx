import { CheckIcon } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * The visual box of a checkbox inside a menu item (`CommandItem`), where the item itself carries the
 * semantics (`aria-checked` / `aria-selected`). Purely decorative.
 */
export function CheckboxIndicator({ checked, className }: { checked: boolean; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-4 shrink-0 items-center justify-center rounded-full border border-border-strong transition-colors",
        checked && "border-primary bg-primary text-primary-foreground",
        className,
      )}
    >
      {checked && <CheckIcon className="size-2.5 text-current" strokeWidth={3} />}
    </span>
  )
}
