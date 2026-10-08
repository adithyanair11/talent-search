import { Slot } from "radix-ui"
import { cn } from "@/lib/utils"

/** The `<main>` landmark: the skip link's target, and where focus goes when a dialog's opener is gone. */
export const MAIN_ID = "main"

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
      {/* First stop for keyboard users: skips the sidebar (or the mobile top bar). */}
      <a
        href={`#${MAIN_ID}`}
        className="sr-only z-50 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-lg focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-sidebar-border bg-surface/60 text-sidebar-foreground md:flex">
        {sidebar}
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-border bg-background/75 px-4 backdrop-blur-xl backdrop-saturate-150 md:hidden">
          {topBarStart ?? <Brand />}
          {topBarEnd}
        </header>
        <main
          id={MAIN_ID}
          tabIndex={-1}
          className="flex-1 pb-[calc(3.5rem+env(safe-area-inset-bottom))] outline-none md:pb-0"
        >{children}</main>
        <nav
          aria-label="Primary"
          className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/80 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl backdrop-saturate-150 md:hidden"
        >
          <div className="grid h-14 auto-cols-fr grid-flow-col">{tabBar}</div>
        </nav>
      </div>
    </div>
  )
}

export function Brand({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 text-base font-semibold tracking-[-0.015em] whitespace-nowrap", className)}>
      <span aria-hidden className="grid size-6 place-items-center rounded-full bg-primary">
        <span className="size-2.5 rounded-full border-2 border-primary-foreground" />
      </span>
      Talent Search
    </span>
  )
}

export function SidebarHeader({ children }: { children?: React.ReactNode }) {
  return <div className="flex h-16 shrink-0 items-center justify-between px-5">{children ?? <Brand />}</div>
}

export function SidebarBody({ children }: { children: React.ReactNode }) {
  return <nav aria-label="Primary" className="flex-1 space-y-6 overflow-y-auto px-3 py-2">{children}</nav>
}

export function SidebarFooter({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex shrink-0 items-center justify-between gap-2 px-3 py-4">
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
        <div className="mb-1 flex h-7 items-center justify-between pr-1 pl-3">
          <h2 className="text-xs font-medium tracking-[0.06em] text-muted-foreground uppercase">{title}</h2>
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
          "flex h-9 w-full items-center gap-2.5 rounded-full px-3 text-left text-base outline-none transition-colors",
          "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring/50",
          "[&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground",
          active && "bg-card font-medium text-sidebar-accent-foreground shadow-sm ring-1 ring-border hover:bg-card [&_svg]:text-primary",
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
        "flex flex-col items-center justify-center gap-1 text-[11px] font-medium text-muted-foreground outline-none transition-colors",
        "focus-visible:bg-accent [&_svg]:size-5",
        active && "text-primary [&_svg]:fill-primary/15",
        className,
      )}
      {...props}
    >
      {icon}
      <Slot.Slottable>{asChild ? children : <span>{label}</span>}</Slot.Slottable>
    </Comp>
  )
}
