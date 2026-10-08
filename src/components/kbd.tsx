import { cn } from "@/lib/utils"

/** Keyboard shortcut hint. Hidden on touch-first (coarse pointer) devices. */
export function Kbd({ className, ...props }: React.ComponentProps<"kbd">) {
  return (
    <kbd
      className={cn(
        "pointer-coarse:hidden inline-flex h-5 min-w-5 items-center justify-center rounded-[4px] border border-border bg-background px-1 font-mono text-[11px] leading-none font-medium text-muted-foreground",
        className,
      )}
      {...props}
    />
  )
}
