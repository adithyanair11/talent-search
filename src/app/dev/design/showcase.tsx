"use client"

import {
  BookmarkIcon,
  BriefcaseIcon,
  CodeIcon,
  DatabaseIcon,
  FolderIcon,
  HistoryIcon,
  InboxIcon,
  ListIcon,
  PaletteIcon,
  PlusIcon,
  RotateCcwIcon,
  SearchIcon,
  SearchXIcon,
  ServerIcon,
  UsersIcon,
} from "lucide-react"
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import {
  AppShell,
  SidebarBody,
  SidebarFooter,
  SidebarHeader,
  SidebarItem,
  SidebarSection,
  TabBarItem,
} from "@/components/app-shell"
import { CandidateAvatar } from "@/components/candidate-avatar"
import {
  CandidateCard,
  CandidateCardList,
  CandidateCardListSkeleton,
  CandidateCardSkeleton,
  ShortlistIconButton,
} from "@/components/candidate-card"
import { CandidateList, CandidateRow, CandidateRowSkeleton } from "@/components/candidate-row"
import { CandidateSheet } from "@/components/candidate-sheet"
import { CheckboxIndicator } from "@/components/checkbox-indicator"
import { CompanyLogo } from "@/components/company-logo"
import { Composer, type ComposerSuggestion } from "@/components/composer"
import { EmptyState } from "@/components/empty-state"
import { ErrorState } from "@/components/error-state"
import {
  AddFilterChip,
  FilterChip,
  FilterChipList,
  FilterChipOptions,
  FilterChipsSkeleton,
} from "@/components/filter-chip"
import { Kbd } from "@/components/kbd"
import { type Plan, PlanBadge } from "@/components/plan-badge"
import { Tag } from "@/components/tag"
import { THINKING_STEPS, ThinkingPanel, ThinkingSteps, useThinkingSteps } from "@/components/thinking-steps"
import { ThemeToggle } from "@/components/theme-toggle"
import { toast, toastUndo } from "@/components/toast"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Command, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Skeleton } from "@/components/ui/skeleton"
import { UpgradeDialog } from "@/components/upgrade-dialog"
import type { CandidateDetail, CandidateSummary } from "@/lib/candidate"
import { cn } from "@/lib/utils"
import { FIXTURE_CANDIDATES } from "./fixtures"

const [AMARA, STAFF, OPEN, JUNIOR] = FIXTURE_CANDIDATES

const LONG: CandidateDetail = {
  ...JUNIOR,
  id: "fixture_long",
  full_name: "Maximiliana Alexandrovna Konstantinopoulou-Fitzgerald",
  avatar_url: null,
  current_company_logo_url: null,
  current_title: "Staff Machine Learning Infrastructure Engineer",
}

const MATCHED: ReadonlySet<string> = new Set(["Terraform", "Datadog", "User Research"])

const SUGGESTIONS: readonly ComposerSuggestion[] = [
  { label: "Senior React engineers in New York who are open to work", icon: CodeIcon },
  { label: "Data scientists with Python and SQL, 5+ years", icon: DatabaseIcon },
  { label: "Backend engineers in Austin who know Go or Rust", icon: ServerIcon },
  { label: "Product designers from startups", icon: PaletteIcon },
]

const CITIES = [
  "New York", "San Francisco", "Los Angeles", "Seattle", "Chicago",
  "Austin", "Boston", "Denver", "Atlanta", "Miami",
] as const

const SHORTLISTS = [
  { id: "s1", name: "Platform hires Q4", count: 12 },
  { id: "s2", name: "Design leads", count: 4 },
  { id: "s3", name: "Backup pipeline — NYC", count: 0 },
]
const SAVED = [
  { id: "b1", name: "Senior React, New York, open to work" },
  { id: "b2", name: "Staff data engineers at startups" },
]

type ListState = "success" | "pending" | "empty" | "unsupported" | "error"
type SidebarState = "success" | "pending" | "empty" | "error"
type ThemeMode = "side-by-side" | "light" | "dark"
type ViewMode = "desktop" | "375px"
export type FrameTheme = "light" | "dark"

/* ——— Theme panes ———
 * Each Block renders its demo once per pane. A pane scopes a theme with `.theme-light` / `.theme-dark`
 * (globals.css), so light and dark sit side by side. Overlays portal to <body> and follow the global theme.
 */

type PaneId = "light" | "dark" | "page"
const PanesContext = createContext<readonly PaneId[]>(["page"])

export function DesignShowcase({ frame, theme }: { frame: boolean; theme: FrameTheme }) {
  const [mode, setMode] = useState<ThemeMode>("side-by-side")
  const [view, setView] = useState<ViewMode>("desktop")

  // Inside a 375px iframe the whole page is one theme; no toolbar, no panes.
  if (frame) {
    return (
      <div className={cn(theme === "dark" ? "theme-dark" : "theme-light", "min-h-dvh bg-background text-foreground")}>
        <PanesContext.Provider value={["page"]}>
          <ShowcaseShell />
        </PanesContext.Provider>
      </div>
    )
  }

  const panes: readonly PaneId[] = mode === "side-by-side" ? ["light", "dark"] : [mode]

  return (
    <PanesContext.Provider value={panes}>
      <div className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5 sm:px-6">
          <span className="text-sm font-semibold">/dev/design</span>
          <Segmented label="Theme" value={mode} onChange={setMode} options={["side-by-side", "light", "dark"]} />
          <Segmented label="View" value={view} onChange={setView} options={["desktop", "375px"]} />
          <span className="text-xs text-muted-foreground max-lg:hidden">
            Popovers, dialogs, sheets and toasts follow the global theme toggle (sidebar footer).
          </span>
        </div>
      </div>
      {view === "desktop" ? <ShowcaseShell /> : <PhoneFrames />}
    </PanesContext.Provider>
  )
}

function PhoneFrames() {
  return (
    <div className="flex flex-wrap justify-center gap-8 px-4 py-10">
      {(["light", "dark"] as const).map((t) => (
        <figure key={t} className="space-y-3">
          <figcaption className="text-center text-sm text-muted-foreground">375 × 812 · {t}</figcaption>
          <iframe
            title={`Design system at 375px, ${t}`}
            src={`/dev/design?frame=1&theme=${t}`}
            className="h-[812px] w-[375px] max-w-full rounded-[2rem] border border-border-strong bg-background shadow-lg"
          />
        </figure>
      ))}
    </div>
  )
}

function ShowcaseShell() {
  const [plan, setPlan] = useState<Plan>({ plan: "free", searches_remaining: 1 })
  const [upgrade, setUpgrade] = useState<{ open: boolean; reason: "quota" | "manual" }>({
    open: false,
    reason: "quota",
  })
  const [sidebarState, setSidebarState] = useState<SidebarState>("success")
  const [active, setActive] = useState("search")
  const wide = useContext(PanesContext).length > 1

  return (
    <AppShell
      sidebar={
        <>
          <SidebarHeader />
          <SidebarBody>
            <SidebarSection>
              <SidebarItem icon={<SearchIcon />} active={active === "search"} onClick={() => setActive("search")}>
                Search
              </SidebarItem>
            </SidebarSection>
            <SidebarLists state={sidebarState} active={active} onSelect={setActive} />
          </SidebarBody>
          <SidebarFooter>
            <PlanBadge plan={plan} onClick={() => setUpgrade({ open: true, reason: "manual" })} />
            <ThemeToggle />
          </SidebarFooter>
        </>
      }
      topBarEnd={
        <div className="flex items-center gap-1">
          <PlanBadge plan={plan} onClick={() => setUpgrade({ open: true, reason: "manual" })} />
          <ThemeToggle />
        </div>
      }
      tabBar={
        <>
          <TabBarItem icon={<SearchIcon />} label="Search" active={active === "search"} onClick={() => setActive("search")} />
          <TabBarItem icon={<BookmarkIcon />} label="Shortlists" active={SHORTLISTS.some((l) => l.id === active)} onClick={() => setActive("s1")} />
          <TabBarItem icon={<HistoryIcon />} label="Saved" active={SAVED.some((b) => b.id === active)} onClick={() => setActive("b1")} />
        </>
      }
    >
      <div className={cn("mx-auto w-full px-4 py-10 sm:px-8 sm:py-14", wide ? "max-w-7xl" : "max-w-4xl")}>
        <header className="mb-14 max-w-2xl">
          <p className="text-sm font-medium text-muted-foreground">Internal · /dev/design</p>
          <h1 className="mt-2 text-4xl font-medium">Design system</h1>
          <p className="mt-3 text-lg text-pretty text-muted-foreground">
            Every token and component in every state, light and dark. Switch View to 375px for the phone layout.
            Source of truth: <code className="font-mono text-base">docs/design.md</code>.
          </p>
        </header>

        <div className="space-y-24">
          <Foundations />
          <Primitives />
          <ComposerSection />
          <ThinkingSection />
          <FilterChipSection />
          <CandidateCardSection />
          <FlowSection />
          <ResultsSection />
          <SheetSection />
          <StatesSection />
          <PlanSection
            plan={plan}
            setPlan={setPlan}
            openUpgrade={(reason) => setUpgrade({ open: true, reason })}
          />
          <ShortlistMenuSection />
          <ToastSection />
          <Section id="app-shell" title="AppShell">
            <Block
              title="Sidebar list states"
              note="The frame around this page: a quiet warm sidebar with pill items (active = raised card). Below 768px it becomes a translucent top bar and a bottom tab bar (see the 375px view)."
              plain
            >
              <Segmented label="Sidebar state" value={sidebarState} onChange={setSidebarState} options={["success", "pending", "empty", "error"]} />
            </Block>
          </Section>
        </div>
      </div>

      <UpgradeDialog
        open={upgrade.open}
        reason={upgrade.reason}
        onOpenChange={(open) => setUpgrade((u) => ({ ...u, open }))}
      />
    </AppShell>
  )
}

/* ——— Layout helpers (showcase only) ——— */

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="scroll-mt-24">
      <h2 id={`${id}-h`} className="mb-8 text-2xl font-semibold">
        {title}
      </h2>
      <div className="space-y-12">{children}</div>
    </section>
  )
}

/**
 * One demo. `children` renders once per theme pane; pass a function to vary by pane (e.g. only the first
 * pane registers the ⌘K shortcut). `plain` renders once, outside panes (controls).
 */
function Block({
  title,
  note,
  children,
  className,
  plain = false,
}: {
  title: string
  note?: string
  children: React.ReactNode | ((first: boolean) => React.ReactNode)
  className?: string
  plain?: boolean
}) {
  const panes = useContext(PanesContext)
  const render = (first: boolean) => (typeof children === "function" ? children(first) : children)
  return (
    <div>
      <h3 className="text-base font-semibold">{title}</h3>
      {note && <p className="mt-1 max-w-3xl text-sm text-pretty text-muted-foreground">{note}</p>}
      {plain || (panes.length === 1 && panes[0] === "page") ? (
        <div className={cn("mt-4", className)}>{render(true)}</div>
      ) : (
        <div className={cn("mt-4 grid gap-4", panes.length > 1 && "xl:grid-cols-2")}>
          {panes.map((pane, i) => (
            <div
              key={pane}
              className={cn(
                pane === "dark" ? "theme-dark" : "theme-light",
                "min-w-0 rounded-2xl border border-border bg-background p-4 text-foreground sm:p-6",
              )}
            >
              <p className="mb-3 font-mono text-[10px] tracking-wider text-muted-foreground uppercase">{pane}</p>
              <div className={className}>{render(i === 0)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Caption({ children }: { children: React.ReactNode }) {
  return <p className="mb-2 text-xs font-medium text-muted-foreground">{children}</p>
}

function Segmented<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: T
  onChange: (v: T) => void
  options: readonly T[]
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex flex-wrap rounded-full border border-border bg-card p-0.5">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          role="radio"
          aria-checked={value === o}
          onClick={() => onChange(o)}
          className={cn(
            "h-7 rounded-full px-3 text-sm text-muted-foreground capitalize transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50",
            value === o && "bg-foreground font-medium text-background hover:text-background",
          )}
        >
          {o}
        </button>
      ))}
    </div>
  )
}

/* ——— Sidebar lists ——— */

function SidebarLists({ state, active, onSelect }: { state: SidebarState; active: string; onSelect: (id: string) => void }) {
  const addAction = (
    <Button variant="ghost" size="icon-xs" aria-label="New shortlist" onClick={() => toast("New shortlist dialog")}>
      <PlusIcon />
    </Button>
  )
  if (state === "pending") {
    return (
      <>
        {["Shortlists", "Saved searches"].map((t) => (
          <SidebarSection key={t} title={t}>
            {[0, 1, 2].map((i) => (
              <li key={i} className="flex h-9 items-center gap-2.5 px-3">
                <Skeleton className="size-4 rounded-full" />
                <Skeleton className={cn("h-3.5 rounded-full", i === 1 ? "w-24" : "w-32")} />
              </li>
            ))}
          </SidebarSection>
        ))}
      </>
    )
  }
  if (state === "error") {
    return (
      <SidebarSection title="Shortlists">
        <li className="px-1">
          <ErrorState variant="inline" message="Couldn't load lists" onRetry={() => toast("Retrying…")} />
        </li>
      </SidebarSection>
    )
  }
  if (state === "empty") {
    return (
      <>
        <SidebarSection title="Shortlists" action={addAction}>
          <li className="px-3 py-1 text-sm text-muted-foreground">Bookmark a candidate to start a list.</li>
        </SidebarSection>
        <SidebarSection title="Saved searches">
          <li className="px-3 py-1 text-sm text-muted-foreground">Save a search to re-run it later.</li>
        </SidebarSection>
      </>
    )
  }
  return (
    <>
      <SidebarSection title="Shortlists" action={addAction}>
        {SHORTLISTS.map((s) => (
          <SidebarItem key={s.id} icon={<FolderIcon />} count={s.count} active={active === s.id} onClick={() => onSelect(s.id)}>
            {s.name}
          </SidebarItem>
        ))}
      </SidebarSection>
      <SidebarSection title="Saved searches">
        {SAVED.map((b) => (
          <SidebarItem key={b.id} icon={<HistoryIcon />} active={active === b.id} onClick={() => onSelect(b.id)}>
            {b.name}
          </SidebarItem>
        ))}
      </SidebarSection>
    </>
  )
}

/* ——— Foundations ——— */

const RAMP = ["50", "100", "200", "300", "400", "500", "600", "700", "800", "900", "950"] as const
const ROLES = [
  ["background", "bg-background"],
  ["surface", "bg-surface"],
  ["card", "bg-card"],
  ["muted", "bg-muted"],
  ["accent (neutral hover)", "bg-accent"],
  ["border", "bg-border"],
  ["foreground", "bg-foreground"],
  ["muted-foreground", "bg-muted-foreground"],
  ["primary", "bg-primary"],
  ["primary-subtle", "bg-primary-subtle"],
  ["success", "bg-success"],
  ["warning", "bg-warning"],
  ["destructive", "bg-destructive"],
] as const
const TYPE = [
  ["4xl · 40/46 · 500", "text-4xl font-medium", "Who are you looking for?"],
  ["3xl · 32/38 · 500", "text-3xl font-medium", "Find the right people"],
  ["2xl · 24/30 · 600", "text-2xl font-semibold", "Platform hires Q4"],
  ["xl · 20/28 · 400", "text-xl", "Senior React engineers in NYC"],
  ["lg · 16/24", "text-lg", "Empty-state sentence, inputs on mobile"],
  ["base · 14/20 (body)", "text-base", "DevOps Engineer at Copperline"],
  ["sm · 13/18", "text-sm", "New York, NY · 4 yrs"],
  ["xs · 12/16", "text-xs", "Section labels, counts, badges"],
] as const

function Foundations() {
  const [replay, setReplay] = useState(0)
  return (
    <Section id="foundations" title="Foundations">
      <Block title="Stone ramp" note="One warm grey, 11 steps. Components use semantic roles, not ramp steps.">
        <div className="grid grid-cols-6 gap-2 sm:grid-cols-11">
          {RAMP.map((step) => (
            <div key={step} className="space-y-1.5">
              <div className="h-12 rounded-lg border border-border" style={{ background: `var(--gray-${step})` }} />
              <p className="font-mono text-xs text-muted-foreground">{step}</p>
            </div>
          ))}
        </div>
      </Block>
      <Block title="Semantic roles" note="Forest green is the only accent: primary action, focus ring, selection, matched skills. Status colours appear as text or subtle tints.">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {ROLES.map(([name, cls]) => (
            <div key={name} className="flex items-center gap-2.5">
              <span className={cn("size-8 shrink-0 rounded-lg border border-border", cls)} />
              <span className="text-sm">{name}</span>
            </div>
          ))}
        </div>
      </Block>
      <Block title="Gradient & glow" note="Used only on the composer's focus ring and send button, the active thinking dot and the upgrade mark. Never on text, cards or backgrounds.">
        <div className="flex flex-wrap items-center gap-6">
          <div className="text-center">
            <div className="h-12 w-28 rounded-xl bg-[image:var(--accent-gradient)]" />
            <p className="mt-1.5 text-xs text-muted-foreground">--accent-gradient</p>
          </div>
          <div className="text-center">
            <div className="h-12 w-28 rounded-xl border-2 border-gradient shadow-[var(--glow)]" />
            <p className="mt-1.5 text-xs text-muted-foreground">focus: border + --glow</p>
          </div>
        </div>
      </Block>
      <Block title="Type · Plus Jakarta Sans" note="Hierarchy from size and colour more than weight: display sizes at 500, headings 600, body 400. Negative tracking grows with size. Geist Mono only for ranks.">
        <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          {TYPE.map(([label, cls, sample]) => (
            <div key={label} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-baseline sm:gap-6">
              <span className="w-40 shrink-0 font-mono text-xs text-muted-foreground">{label}</span>
              <span className={cn("min-w-0 truncate", cls)}>{sample}</span>
            </div>
          ))}
          <div className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-baseline sm:gap-6">
            <span className="w-40 shrink-0 font-mono text-xs text-muted-foreground">tabular-nums</span>
            <span className="tabular-nums">1,284 candidates · 0123456789</span>
          </div>
        </div>
      </Block>
      <Block title="Radii · elevation">
        <div className="flex flex-wrap items-end gap-6">
          {[["8", "rounded-md"], ["12", "rounded-lg"], ["16", "rounded-xl"], ["pill", "rounded-full"]].map(([px, cls]) => (
            <div key={px} className="text-center">
              <div className={cn("h-14 border border-border-strong bg-surface", px === "pill" ? "w-20" : "w-14", cls)} />
              <p className="mt-1.5 font-mono text-xs text-muted-foreground">{px}</p>
            </div>
          ))}
          <span className="mx-1 h-14 w-px bg-border" />
          {[
            ["Hairline", "border border-border"],
            ["Soft (card hover)", "border border-border shadow-sm"],
            ["Composer", "border border-border shadow-composer"],
            ["Overlay", "shadow-lg"],
          ].map(([label, cls]) => (
            <div key={label} className="text-center">
              <div className={cn("size-14 rounded-xl bg-card", cls)} />
              <p className="mt-1.5 text-xs text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>
      </Block>
      <Block title="Motion" note="150 ms hover/press, 200 ms surfaces, 250 ms entrances, all ease-out. Shimmer for loading and thinking. All of it stops under prefers-reduced-motion.">
        <div className="space-y-4">
          <Button variant="outline" size="sm" onClick={() => setReplay((n) => n + 1)}>
            <RotateCcwIcon /> Replay entrances
          </Button>
          <div key={replay} className="flex flex-wrap items-center gap-3">
            {[0, 1, 2].map((i) => (
              <span key={i} className="animate-chip-in rounded-full border border-border bg-card px-3 py-1 text-sm" style={{ animationDelay: `${i * 40}ms` }}>
                chip-in · {i * 40}ms
              </span>
            ))}
            <span className="animate-fade-up rounded-xl border border-border bg-card px-3 py-1 text-sm">fade-up</span>
            <span className="text-shimmer text-sm font-medium">text-shimmer</span>
            <Skeleton className="h-6 w-28 rounded-full" />
          </div>
        </div>
      </Block>
    </Section>
  )
}

/* ——— Primitives ——— */

function Primitives() {
  return (
    <Section id="primitives" title="Primitives">
      <Block title="Button" note="Pills. One primary (green) per view. Outline for secondary, ghost for toolbars and icon buttons.">
        <div className="flex flex-wrap items-center gap-3">
          <Button>Shortlist</Button>
          <Button variant="outline">Save search</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Delete list</Button>
          <Button variant="link">Link</Button>
          <Button disabled>Disabled</Button>
          <Button size="sm" variant="outline">Small</Button>
          <Button size="lg">Large</Button>
          <Button size="icon" variant="ghost" aria-label="Bookmark"><BookmarkIcon /></Button>
        </div>
      </Block>
      <Block title="Badge · Tag · Kbd" note="Badge = status (text + tint). Tag = neutral data (skills), pill-shaped; matched tags take the green tint. Kbd = shortcut hint, hidden on touch.">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="success">Open to work</Badge>
          <Badge variant="warning">No searches left</Badge>
          <Badge variant="destructive">Canceled</Badge>
          <Badge variant="neutral">Startup</Badge>
          <Badge>Paid</Badge>
          <span className="mx-2 h-4 w-px bg-border" />
          <Tag>Kubernetes</Tag>
          <Tag matched>React</Tag>
          <Tag>+3</Tag>
          <span className="mx-2 h-4 w-px bg-border" />
          <Kbd>⌘</Kbd><Kbd>K</Kbd><Kbd>/</Kbd><Kbd>Esc</Kbd>
        </div>
      </Block>
      <Block title="Avatar · Company logo" note="Real images carry the colour. Hairline inner ring; initials / building icon only when an image fails.">
        <div className="flex flex-wrap items-center gap-4">
          <CandidateAvatar src={AMARA.avatar_url} name={AMARA.full_name} size="sm" />
          <CandidateAvatar src={AMARA.avatar_url} name={AMARA.full_name} />
          <CandidateAvatar src={STAFF.avatar_url} name={STAFF.full_name} size="lg" />
          <CandidateAvatar src={null} name="Lena Park" />
          <CandidateAvatar src={null} name="Lena Park" size="lg" />
          <span className="mx-2 h-6 w-px bg-border" />
          <CompanyLogo src={AMARA.current_company_logo_url} company={AMARA.current_company} size="xs" />
          <CompanyLogo src={AMARA.current_company_logo_url} company={AMARA.current_company} size="sm" />
          <CompanyLogo src={STAFF.current_company_logo_url} company={STAFF.current_company} size="md" />
          <CompanyLogo src={OPEN.current_company_logo_url} company={OPEN.current_company} size="lg" />
          <CompanyLogo src={null} company="Unknown" size="md" />
        </div>
      </Block>
    </Section>
  )
}

/* ——— Composer ——— */

const noop = () => {}
/** Forces the focus look on a static demo (the real one comes from :focus-within). */
const FORCED_FOCUS = "[&_form]:border-gradient [&_form]:shadow-[var(--glow)]"

function InteractiveComposer({ variant, shortcut }: { variant: "hero" | "docked"; shortcut: boolean }) {
  const [value, setValue] = useState("")
  const [loading, setLoading] = useState(false)
  useEffect(() => {
    if (!loading) return
    const t = setTimeout(() => setLoading(false), 1500)
    return () => clearTimeout(t)
  }, [loading])
  return (
    <Composer
      variant={variant}
      value={value}
      onChange={setValue}
      onSubmit={() => setLoading(true)}
      loading={loading}
      globalShortcut={shortcut}
      title={variant === "hero" ? "Who are you looking for?" : undefined}
      description={variant === "hero" ? "Describe the role in plain English. We turn it into filters you can edit." : undefined}
      suggestions={variant === "hero" ? SUGGESTIONS : undefined}
      onSuggestion={setValue}
    />
  )
}

function ComposerSection() {
  return (
    <Section id="composer" title="Composer">
      <Block title="Hero · first visit" note="Centred on an airy page: title, one line of sub-copy, a roomy box with the send button inside, example briefs as pills. ⌘K or / focuses (first pane only). Enter sends, Shift+Enter adds a line.">
        {(first) => (
          <div className="py-6 sm:py-10">
            <InteractiveComposer variant="hero" shortcut={first} />
          </div>
        )}
      </Block>
      <Block title="Hero states" className="space-y-6">
        <div>
          <Caption>Focused</Caption>
          <Composer variant="hero" value="" onChange={noop} onSubmit={noop} globalShortcut={false} className={FORCED_FOCUS} />
        </div>
        <div>
          <Caption>Filled (send ready)</Caption>
          <Composer variant="hero" value="Senior backend engineers in Seattle with Go and Kubernetes, 5+ years" onChange={noop} onSubmit={noop} globalShortcut={false} />
        </div>
        <div>
          <Caption>Too long (counter + error)</Caption>
          <Composer variant="hero" value={"Senior engineers ".repeat(32)} onChange={noop} onSubmit={noop} globalShortcut={false} />
        </div>
      </Block>
      <Block title="Docked · above results" note="After a search the composer moves to the top and shrinks to one line, like a chat input under an answer." className="space-y-6">
        <div>
          <Caption>Interactive</Caption>
          <InteractiveComposer variant="docked" shortcut={false} />
        </div>
        <div>
          <Caption>Focused</Caption>
          <Composer value="Staff data engineers at startups" onChange={noop} onSubmit={noop} globalShortcut={false} className={FORCED_FOCUS} />
        </div>
        <div>
          <Caption>Loading</Caption>
          <Composer value="Staff data engineers at startups" onChange={noop} onSubmit={noop} loading globalShortcut={false} />
        </div>
        <div>
          <Caption>Disabled (no searches left)</Caption>
          <Composer value="" onChange={noop} onSubmit={noop} disabled globalShortcut={false} placeholder="Upgrade to run another search" />
        </div>
        <div>
          <Caption>Error</Caption>
          <Composer value="Designers in Paris" onChange={noop} onSubmit={noop} error="Search is unavailable right now. Try again in a moment." globalShortcut={false} />
        </div>
      </Block>
    </Section>
  )
}

/* ——— ThinkingSteps ——— */

function AutoplayThinking({ usesModel }: { usesModel: boolean }) {
  const [running, setRunning] = useState(true)
  useEffect(() => {
    const t = setTimeout(() => setRunning((r) => !r), running ? 3200 : 1400)
    return () => clearTimeout(t)
  }, [running])
  const step = useThinkingSteps(running, usesModel)
  return (
    <ThinkingPanel>
      <ThinkingSteps active={step ?? THINKING_STEPS.length} usesModel={usesModel} />
    </ThinkingPanel>
  )
}

function ThinkingSection() {
  return (
    <Section id="thinking" title="ThinkingSteps">
      <Block title="Live" note="While a search runs: Reading your brief → Understanding filters → Finding people → Ranking. Timer-driven (one API call, no streaming); the last step holds until the response lands. Screen readers hear the active step.">
        <div className="space-y-4">
          <AutoplayThinking usesModel />
          <div>
            <Caption>Edited filters (skips the model)</Caption>
            <AutoplayThinking usesModel={false} />
          </div>
        </div>
      </Block>
      <Block title="Each step, frozen" className="space-y-3">
        {[0, 1, 2, 3, 4].map((i) => (
          <ThinkingPanel key={i} className="animate-none">
            <ThinkingSteps active={i} />
          </ThinkingPanel>
        ))}
      </Block>
      <Block title="With placeholders" note="On the results page the panel sits above shaped placeholders: chips and cards shimmer in place.">
        <div className="space-y-4">
          <ThinkingPanel>
            <ThinkingSteps active={2} />
          </ThinkingPanel>
          <FilterChipsSkeleton />
          <CandidateCardListSkeleton rows={2} />
        </div>
      </Block>
    </Section>
  )
}

/* ——— FilterChip ——— */

type DemoFilter = { key: string; label: string; values: string[] }
const INITIAL_FILTERS: DemoFilter[] = [
  { key: "role", label: "Role", values: ["Backend Engineer"] },
  { key: "seniority", label: "Seniority", values: ["Senior", "Staff"] },
  { key: "location", label: "Location", values: ["Seattle"] },
  { key: "years", label: "Experience", values: ["5+ yrs"] },
  { key: "skills", label: "Skills", values: ["Go", "Kubernetes"] },
]

function InteractiveChips() {
  const [filters, setFilters] = useState<DemoFilter[]>(INITIAL_FILTERS)
  const [replay, setReplay] = useState(0)

  const remove = (key: string) => {
    const idx = filters.findIndex((f) => f.key === key)
    const removed = filters[idx]
    if (!removed) return
    setFilters(filters.filter((f) => f.key !== key))
    toastUndo(`Removed ${removed.label.toLowerCase()} filter`, () =>
      setFilters((cur) => [...cur.slice(0, idx), removed, ...cur.slice(idx)]),
    )
  }

  const toggleCity = useCallback((city: string) => {
    setFilters((prev) =>
      prev.map((f) =>
        f.key === "location"
          ? { ...f, values: f.values.includes(city) ? f.values.filter((v) => v !== city) : [...f.values, city] }
          : f,
      ),
    )
  }, [])

  return (
    <div className="space-y-4">
      <FilterChipList
        key={replay}
        heading="Understood"
        onClear={() => {
          const prev = filters
          setFilters([])
          toastUndo("Cleared all filters", () => setFilters(prev))
        }}
      >
        {filters.map((f, i) => (
          <FilterChip
            key={f.key}
            animateIn
            index={i}
            label={f.label}
            value={f.values.length ? f.values.join(", ") : "Any"}
            onRemove={() => remove(f.key)}
            editor={
              f.key === "location" ? (
                <FilterChipOptions options={CITIES} selected={f.values} onToggle={toggleCity} placeholder="Filter cities…" />
              ) : (
                <p className="text-sm text-muted-foreground">Editor for {f.label.toLowerCase()} goes here.</p>
              )
            }
          />
        ))}
        <AddFilterChip
          editor={<FilterChipOptions options={["Open to work", "Company type", "Education", "Past company"]} selected={[]} onToggle={(v) => toast(`Add ${v}`)} />}
        />
      </FilterChipList>
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          setFilters(INITIAL_FILTERS)
          setReplay((n) => n + 1)
        }}
      >
        <RotateCcwIcon /> Replay animate-in
      </Button>
    </div>
  )
}

function FilterChipSection() {
  return (
    <Section id="filter-chips" title="FilterChip">
      <Block title="Understood filters · interactive" note="After a search the filters animate in as pills (40 ms stagger) under “✦ Understood”. Click to edit (Location opens the option editor). × removes with Undo. Clear all is quiet text.">
        <InteractiveChips />
      </Block>
      <Block title="States">
        <FilterChipList>
          <FilterChip label="Location" value="New York" onRemove={noop} />
          <FilterChip label="Open to work" value="Yes" />
          <FilterChip label="Salary" value="$200k+" unsupported hint="Candidate records don't include salary." onRemove={noop} />
          <FilterChip label="Seniority" value="Senior" disabled onRemove={noop} />
          <FilterChip label="Skills" value="React, TypeScript, GraphQL, Node.js, PostgreSQL" onRemove={noop} className="max-w-64" />
        </FilterChipList>
        <p className="mt-3 text-sm text-muted-foreground">Default · read-only · unsupported (not applied) · disabled · truncated</p>
      </Block>
      <Block title="Loading">
        <FilterChipsSkeleton />
      </Block>
    </Section>
  )
}

/* ——— CandidateCard ——— */

function useShortlistDemo() {
  const [shortlisted, setShortlisted] = useState<Set<string>>(() => new Set([STAFF.id]))
  const toggle = useCallback((id: string) => {
    setShortlisted((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
        toastUndo("Removed from Platform hires Q4", () => setShortlisted((p) => new Set(p).add(id)))
      } else {
        next.add(id)
        toast.success("Added to Platform hires Q4")
      }
      return next
    })
  }, [])
  const renderShortlist = useCallback(
    (c: CandidateSummary, on: boolean) => (
      <ShortlistIconButton name={c.full_name} shortlisted={on} pending={c.id === JUNIOR.id} onClick={() => toggle(c.id)} />
    ),
    [toggle],
  )
  return { shortlisted, renderShortlist }
}

function CardStates() {
  const { shortlisted, renderShortlist } = useShortlistDemo()
  const [selected, setSelected] = useState<string | null>(OPEN.id)
  return (
    <CandidateCardList>
      {[AMARA, STAFF, OPEN, JUNIOR, LONG].map((c, i) => (
        <CandidateCard
          key={c.id}
          candidate={c}
          rank={i + 1}
          onOpen={setSelected}
          selected={selected === c.id}
          shortlisted={shortlisted.has(c.id)}
          renderShortlist={renderShortlist}
          matchedSkills={MATCHED}
          priority={i < 2}
        />
      ))}
    </CandidateCardList>
  )
}

function RowStates() {
  const { shortlisted, renderShortlist } = useShortlistDemo()
  const [selected, setSelected] = useState<string | null>(STAFF.id)
  return (
    <CandidateList>
      {[AMARA, STAFF, OPEN].map((c, i) => (
        <CandidateRow
          key={c.id}
          candidate={c}
          rank={i + 1}
          onOpen={setSelected}
          selected={selected === c.id}
          shortlisted={shortlisted.has(c.id)}
          renderShortlist={renderShortlist}
          matchedSkills={MATCHED}
        />
      ))}
      <CandidateRowSkeleton />
    </CandidateList>
  )
}

function CandidateCardSection() {
  return (
    <Section id="candidate-card" title="CandidateCard">
      <Block
        title="Card · states"
        note="Default · shortlisted (bookmark stays visible) · selected (open in the sheet) · open to work · shortlist pending · image fallback + truncation. Matched skills sort first and take the green tint. The bookmark appears on hover/focus with a mouse and is always visible on touch."
      >
        <CardStates />
      </Block>
      <Block title="Row appearance" note="Flat rows in a hairline-divided list, for shortlist pages and dense virtualised lists. Same props; `CandidateRow` is this appearance.">
        <RowStates />
      </Block>
      <Block title="Loading">
        <CandidateCardList>
          <CandidateCardSkeleton />
          <CandidateCardSkeleton />
        </CandidateCardList>
      </Block>
    </Section>
  )
}

const renderIdleShortlist = (c: CandidateSummary, on: boolean) => <ShortlistIconButton name={c.full_name} shortlisted={on} />

/* ——— Flow: composer → thinking → chips → cards ——— */

const FLOW_CHIPS = [
  { label: "Role", value: "DevOps Engineer" },
  { label: "Location", value: "New York" },
  { label: "Skills", value: "Terraform, Datadog" },
  { label: "Experience", value: "3+ yrs" },
]

function FlowDemo() {
  const [phase, setPhase] = useState<"idle" | "thinking" | "done">("idle")
  const [brief, setBrief] = useState("")
  const [run, setRun] = useState(0)
  const step = useThinkingSteps(phase === "thinking", true)

  useEffect(() => {
    if (phase !== "thinking") return
    const t = setTimeout(() => setPhase("done"), 3000)
    return () => clearTimeout(t)
  }, [phase, run])

  const start = (text: string) => {
    setBrief(text)
    setRun((n) => n + 1)
    setPhase("thinking")
  }

  if (phase === "idle") {
    return (
      <div className="py-8 sm:py-14">
        <Composer
          variant="hero"
          value={brief}
          onChange={setBrief}
          onSubmit={start}
          globalShortcut={false}
          title="Who are you looking for?"
          description="Describe the role in plain English. We turn it into filters you can edit."
          suggestions={[{ label: "DevOps engineers in New York with Terraform", icon: BriefcaseIcon }, ...SUGGESTIONS.slice(0, 2)]}
          onSuggestion={start}
        />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <Composer value={brief} onChange={setBrief} onSubmit={start} loading={phase === "thinking"} globalShortcut={false} />
      {phase === "thinking" ? (
        <div className="space-y-4">
          <ThinkingPanel>
            <ThinkingSteps active={step ?? 0} />
          </ThinkingPanel>
          <CandidateCardListSkeleton rows={3} />
        </div>
      ) : (
        <div key={run} className="space-y-5">
          <FilterChipList heading="Understood" onClear={() => setPhase("idle")}>
            {FLOW_CHIPS.map((c, i) => (
              <FilterChip key={c.label} animateIn index={i} label={c.label} value={c.value} onRemove={noop} />
            ))}
          </FilterChipList>
          <div className="flex items-center justify-between">
            <p aria-live="polite" className="animate-fade-up text-sm text-muted-foreground tabular-nums">
              <span className="font-medium text-foreground">128</span> candidates · best match first
            </p>
            <Button variant="ghost" size="sm" onClick={() => setPhase("idle")}>
              <RotateCcwIcon /> Start over
            </Button>
          </div>
          <CandidateCardList>
            {[AMARA, STAFF, OPEN].map((c, i) => (
              <div key={c.id} className="animate-fade-up" style={{ animationDelay: `${200 + i * 60}ms` }}>
                <CandidateCard candidate={c} rank={i + 1} onOpen={noop} renderShortlist={renderIdleShortlist} matchedSkills={MATCHED} />
              </div>
            ))}
          </CandidateCardList>
        </div>
      )}
    </div>
  )
}

function FlowSection() {
  return (
    <Section id="flow" title="Search flow">
      <Block title="Composer → thinking → understood → results" note="The target for the search page (next task). Pick a suggestion or type a brief: the composer docks to the top, the steps run, the understood filters pop in as chips, then cards rise in like a chat answer.">
        <FlowDemo />
      </Block>
    </Section>
  )
}

/* ——— Results (all data-view states) ——— */

function ResultsSection() {
  const [state, setState] = useState<ListState>("success")
  return (
    <Section id="results" title="Result list · data-view states">
      <Block title="State" plain>
        <Segmented label="Result state" value={state} onChange={setState} options={["success", "pending", "empty", "unsupported", "error"]} />
      </Block>
      <Block title="Ranked results" note="Every data view handles loading, empty, error and success. The count is announced politely.">
        <div className="space-y-3">
          {state === "success" && (
            <>
              <p aria-live="polite" className="text-sm text-muted-foreground tabular-nums">
                <span className="font-medium text-foreground">1,284</span> candidates · best match first
              </p>
              <CandidateCardList>
                {FIXTURE_CANDIDATES.map((c, i) => (
                  <CandidateCard key={c.id} candidate={c} rank={i + 1} onOpen={noop} renderShortlist={renderIdleShortlist} matchedSkills={MATCHED} />
                ))}
              </CandidateCardList>
            </>
          )}
          {state === "pending" && (
            <>
              <ThinkingPanel>
                <ThinkingSteps active={3} />
              </ThinkingPanel>
              <CandidateCardListSkeleton rows={3} />
            </>
          )}
          {state === "empty" && (
            <div className="rounded-2xl border border-border bg-card">
              <EmptyState
                icon={SearchXIcon}
                title="No one matches every filter."
                description="Remove a filter or widen the experience range."
                action={<Button variant="outline">Edit filters</Button>}
              />
            </div>
          )}
          {state === "unsupported" && (
            <div className="rounded-2xl border border-border bg-card">
              <EmptyState
                icon={SearchXIcon}
                title="We can't search by salary."
                description="Candidate records don't include compensation, so we returned no one rather than guess. Remove it to search the rest."
                action={<Button variant="outline">Remove salary</Button>}
              />
            </div>
          )}
          {state === "error" && (
            <div className="rounded-2xl border border-border bg-card">
              <ErrorState message="We couldn't load this page of results." onRetry={() => toast("Retrying…")} />
            </div>
          )}
        </div>
      </Block>
    </Section>
  )
}

/* ——— CandidateSheet ——— */

function SheetSection() {
  const [sheet, setSheet] = useState<{ open: boolean; status: "pending" | "error" | "success" }>({
    open: false,
    status: "success",
  })
  const matched = useMemo(() => new Set(STAFF.skills.slice(0, 2)), [])
  return (
    <Section id="candidate-sheet" title="CandidateSheet">
      <Block title="Floating side sheet ≥ 768px · full-height drawer below" note="Inset 8px with a 16px radius on desktop. Opened on demand — feature code imports it with next/dynamic. Follows the global theme." plain>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setSheet({ open: true, status: "success" })}>Open profile</Button>
          <Button variant="outline" onClick={() => setSheet({ open: true, status: "pending" })}>Loading</Button>
          <Button variant="outline" onClick={() => setSheet({ open: true, status: "error" })}>Error</Button>
        </div>
      </Block>
      <CandidateSheet
        open={sheet.open}
        onOpenChange={(open) => setSheet((s) => ({ ...s, open }))}
        status={sheet.status}
        candidate={sheet.status === "success" ? STAFF : undefined}
        onRetry={() => setSheet({ open: true, status: "success" })}
        matchedSkills={matched}
        onPrevious={null}
        onNext={noop}
        positionLabel="1 of 128"
        actions={
          <>
            <Button onClick={() => toast.success("Added to Platform hires Q4")}>
              <BookmarkIcon /> Shortlist
            </Button>
            <Button variant="outline">
              <ListIcon /> Lists
            </Button>
          </>
        }
      />
    </Section>
  )
}

/* ——— Empty / Error ——— */

function StatesSection() {
  return (
    <Section id="states" title="EmptyState · ErrorState">
      <Block title="Block and compact" className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card">
          <EmptyState icon={UsersIcon} title="This shortlist is empty." description="Bookmark people from a search to add them here." action={<Button variant="outline">Find candidates</Button>} />
        </div>
        <div className="rounded-2xl border border-border bg-card">
          <ErrorState message="The server didn't respond. Your shortlists are safe." onRetry={noop} />
        </div>
        <div className="rounded-2xl border border-border bg-card">
          <EmptyState size="compact" icon={InboxIcon} title="No saved searches yet." action={<Button size="sm" variant="ghost">Save this search</Button>} />
        </div>
        <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
          <ErrorState variant="inline" message="Couldn't load lists" onRetry={noop} />
          <ErrorState variant="inline" message="Retrying…" onRetry={noop} retrying />
        </div>
      </Block>
    </Section>
  )
}

/* ——— Plan ——— */

function PlanSection({
  plan,
  setPlan,
  openUpgrade,
}: {
  plan: Plan
  setPlan: (p: Plan) => void
  openUpgrade: (reason: "quota" | "manual") => void
}) {
  return (
    <Section id="plan" title="PlanBadge · UpgradeDialog">
      <Block title="PlanBadge" note="Free with searches left · free with none (amber) · Pro (solid green, static) · loading.">
        <div className="flex flex-wrap items-center gap-3">
          <PlanBadge plan={{ plan: "free", searches_remaining: 1 }} onClick={() => openUpgrade("manual")} />
          <PlanBadge plan={{ plan: "free", searches_remaining: 0 }} onClick={() => openUpgrade("quota")} />
          <PlanBadge plan={{ plan: "paid", searches_remaining: null }} />
          <PlanBadge plan={undefined} />
        </div>
      </Block>
      <Block title="Controls" note="The sidebar badge follows this selection. UpgradeDialog: dialog ≥ 768px, drawer below; opened by a 402 (quota) or the badge (manual). No checkout — the plan flips via the billing webhook." plain>
        <div className="flex flex-wrap items-center gap-3">
          <Segmented
            label="Sidebar plan"
            value={plan.plan === "paid" ? "paid" : plan.searches_remaining ? "free · 1" : "free · 0"}
            onChange={(v) =>
              setPlan(v === "paid" ? { plan: "paid", searches_remaining: null } : { plan: "free", searches_remaining: v === "free · 1" ? 1 : 0 })
            }
            options={["free · 1", "free · 0", "paid"]}
          />
          <Button variant="outline" onClick={() => openUpgrade("quota")}>After 402</Button>
          <Button variant="outline" onClick={() => openUpgrade("manual")}>From badge</Button>
        </div>
      </Block>
    </Section>
  )
}

/* ——— Shortlist popover ——— */

const MENU_LISTS = [
  { id: "s1", name: "Platform hires Q4", count: 12, on: true },
  { id: "s2", name: "Design leads", count: 4, on: false },
  { id: "s3", name: "Backup pipeline — NYC", count: 0, on: false },
]

/** Stand-in for ShortlistMenuContent (which needs the API): same markup and classes, local state. */
function ShortlistMenuMock() {
  const [lists, setLists] = useState(MENU_LISTS)
  return (
    <div className="flex flex-col">
      <Command loop>
        <CommandInput placeholder="Find a list…" aria-label="Find a list" />
        <CommandList className="max-h-64">
          <CommandGroup>
            {lists.map((l) => (
              <CommandItem
                key={l.id}
                value={l.name}
                aria-checked={l.on}
                onSelect={() => setLists((cur) => cur.map((x) => (x.id === l.id ? { ...x, on: !x.on } : x)))}
                className="min-h-11 gap-2.5 rounded-lg md:min-h-9"
              >
                <CheckboxIndicator checked={l.on} />
                <span className="min-w-0 flex-1 truncate">{l.name}</span>
                <span className="text-xs text-muted-foreground tabular-nums">{l.count}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
      <div className="border-t border-border p-1.5">
        <Button variant="ghost" className="w-full justify-start rounded-lg font-normal text-primary hover:text-primary max-md:h-11">
          <PlusIcon />
          New list…
        </Button>
      </div>
    </div>
  )
}

/**
 * The same panel as plain markup for the inline, per-theme preview: a mounted cmdk list scrolls its
 * auto-selected item into view, which would yank this page down on load.
 */
function ShortlistMenuStatic() {
  return (
    <div className="flex flex-col text-sm">
      <div className="flex h-9 items-center gap-2 border-b px-3">
        <SearchIcon className="size-4 shrink-0 opacity-50" />
        <span className="text-muted-foreground">Find a list…</span>
      </div>
      <ul className="p-1">
        {MENU_LISTS.map((l, i) => (
          <li
            key={l.id}
            className={cn("flex min-h-11 items-center gap-2.5 rounded-lg px-2 py-1.5 md:min-h-9", i === 0 && "bg-accent")}
          >
            <CheckboxIndicator checked={l.on} />
            <span className="min-w-0 flex-1 truncate">{l.name}</span>
            <span className="text-xs text-muted-foreground tabular-nums">{l.count}</span>
          </li>
        ))}
      </ul>
      <div className="border-t border-border p-1.5">
        <Button variant="ghost" className="w-full justify-start rounded-lg font-normal text-primary hover:text-primary max-md:h-11">
          <PlusIcon />
          New list…
        </Button>
      </div>
    </div>
  )
}

function ShortlistMenuSection() {
  return (
    <Section id="shortlist-menu" title="Shortlist popover">
      <Block title="Menu" note="Find a list, tick to add or remove (optimistic, Undo toast), or create one inline. Popover ≥ 768px, bottom drawer below. Left: the panel inline; right: the real popover from a card's bookmark." className="flex flex-wrap items-start gap-6">
        <div className="w-72 max-w-full overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-lg">
          <ShortlistMenuStatic />
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <ShortlistIconButton name={STAFF.full_name} shortlisted />
          </PopoverTrigger>
          <PopoverContent align="start" className="w-72 p-0" aria-label={`Shortlists for ${STAFF.full_name}`}>
            <ShortlistMenuMock />
          </PopoverContent>
        </Popover>
      </Block>
    </Section>
  )
}

/* ——— Toasts ——— */

function ToastSection() {
  return (
    <Section id="toasts" title="Toasts">
      <Block title="sonner" note="Confirmations are quiet; destructive actions happen immediately and offer Undo for 6 s. Errors say what failed. Follows the global theme." plain>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => toast.success("Added to Platform hires Q4")}>Success</Button>
          <Button variant="outline" onClick={() => toastUndo("Removed Amara Cohen from Design leads", () => toast("Restored"))}>Undo</Button>
          <Button variant="outline" onClick={() => toastUndo("Deleted saved search", () => toast("Restored"), "Senior React, New York, open to work")}>Undo + description</Button>
          <Button variant="outline" onClick={() => toast.error("Couldn't rename the list. Try again.")}>Error</Button>
          <Button variant="outline" onClick={() => toast("Search saved")}>Neutral</Button>
        </div>
      </Block>
    </Section>
  )
}
