import { Slot } from "radix-ui"
import { cn } from "@/lib/utils"

/**
 * Page frame. ≥ 768px: slim 240px sidebar + content. < 768px: sticky top bar + content + fixed
 * bottom tab bar. Pure layout — pass navigation in as slots so it stays route-agnostic.
 */
export function AppShell({
  sidebar,
  topBarStart,
  topBarEnd,
  tabBar,
  children,
}: {
  sidebar: React.ReactNode
  /** Left side of the mobile top bar (e.g. the company / account menu). Defaults to the brand. */
  topBarStart?: React.ReactNode
  /** Right side of the mobile top bar (e.g. PlanBadge). */
  topBarEnd?: React.ReactNode
  tabBar: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-dvh w-full flex-1">
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex">
        {sidebar}
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-border bg-background/85 px-4 backdrop-blur-md md:hidden">
          {topBarStart ?? <Brand />}
          {topBarEnd}
        </header>
        <main className="flex-1 pb-[calc(3.5rem+env(safe-area-inset-bottom))] md:pb-0">{children}</main>
        <nav
          aria-label="Primary"
          className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
        >
          <div className="grid h-14 auto-cols-fr grid-flow-col">{tabBar}</div>
        </nav>
      </div>
    </div>
  )
}

export function Brand({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 text-base font-semibold tracking-tight whitespace-nowrap", className)}>
      <span aria-hidden className="grid size-5 place-items-center rounded-[5px] bg-foreground">
        <span className="size-2 rounded-full border-2 border-background" />
      </span>
      Talent Search
    </span>
  )
}

export function SidebarHeader({ children }: { children?: React.ReactNode }) {
  return <div className="flex h-14 shrink-0 items-center justify-between px-4">{children ?? <Brand />}</div>
}

export function SidebarBody({ children }: { children: React.ReactNode }) {
  return <nav aria-label="Primary" className="flex-1 space-y-6 overflow-y-auto px-2 py-2">{children}</nav>
}

export function SidebarFooter({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex shrink-0 items-center justify-between gap-2 border-t border-sidebar-border px-3 py-3">
      {children}
    </div>
  )
}

export function SidebarSection({
  title,
  action,
  children,
}: {
  title?: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section>
      {title && (
        <div className="mb-1 flex h-7 items-center justify-between pr-1 pl-2">
          <h2 className="text-xs font-medium text-muted-foreground">{title}</h2>
          {action}
        </div>
      )}
      <ul className="space-y-px">{children}</ul>
    </section>
  )
}

/** Sidebar link/button. Use `asChild` with `next/link`. Active = neutral fill, not the accent. */
export function SidebarItem({
  asChild = false,
  active = false,
  icon,
  count,
  className,
  children,
  ...props
}: React.ComponentProps<"button"> & {
  asChild?: boolean
  active?: boolean
  icon?: React.ReactNode
  count?: number
}) {
  const Comp = asChild ? Slot.Root : "button"
  return (
    <li>
      <Comp
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-base outline-none transition-colors",
          "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring/50",
          "[&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground",
          active && "bg-sidebar-accent font-medium text-sidebar-accent-foreground [&_svg]:text-foreground",
          className,
        )}
        {...props}
      >
        {icon}
        <Slot.Slottable>
          {asChild ? children : <span className="min-w-0 truncate">{children}</span>}
        </Slot.Slottable>
        {count !== undefined && (
          <span className="ml-auto text-xs tabular-nums text-muted-foreground">{count}</span>
        )}
      </Comp>
    </li>
  )
}

/** Bottom tab bar item (mobile). Use `asChild` with `next/link`. */
export function TabBarItem({
  asChild = false,
  active = false,
  icon,
  label,
  className,
  children,
  ...props
}: React.ComponentProps<"button"> & {
  asChild?: boolean
  active?: boolean
  icon?: React.ReactNode
  label?: string
}) {
  const Comp = asChild ? Slot.Root : "button"
  return (
    <Comp
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-muted-foreground outline-none transition-colors",
        "focus-visible:bg-accent [&_svg]:size-5",
        active && "text-foreground",
        className,
      )}
      {...props}
    >
      {icon}
      <Slot.Slottable>{asChild ? children : <span>{label}</span>}</Slot.Slottable>
    </Comp>
  )
}
