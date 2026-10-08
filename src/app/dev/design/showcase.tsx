"use client"

import {
  BookmarkIcon,
  FolderIcon,
  HistoryIcon,
  InboxIcon,
  ListIcon,
  PlusIcon,
  SearchIcon,
  SearchXIcon,
  UsersIcon,
} from "lucide-react"
import { useCallback, useMemo, useState } from "react"
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
  CandidateList,
  CandidateListSkeleton,
  CandidateRow,
  CandidateRowSkeleton,
} from "@/components/candidate-row"
import { CandidateSheet } from "@/components/candidate-sheet"
import { CompanyLogo } from "@/components/company-logo"
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
import { SearchBar } from "@/components/search-bar"
import { Tag } from "@/components/tag"
import { ThemeToggle } from "@/components/theme-toggle"
import { toast, toastUndo } from "@/components/toast"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { UpgradeDialog } from "@/components/upgrade-dialog"
import type { CandidateDetail } from "@/lib/candidate"
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

export function DesignShowcase() {
  const [plan, setPlan] = useState<Plan>({ plan: "free", searches_remaining: 1 })
  const [upgrade, setUpgrade] = useState<{ open: boolean; reason: "quota" | "manual" }>({
    open: false,
    reason: "quota",
  })
  const [sidebarState, setSidebarState] = useState<SidebarState>("success")
  const [active, setActive] = useState("search")

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
      <div className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-8 sm:py-14">
        <header className="mb-14">
          <p className="text-sm font-medium text-muted-foreground">Internal · /dev/design</p>
          <h1 className="mt-2 text-3xl font-semibold">Design system</h1>
          <p className="mt-3 max-w-xl text-lg text-muted-foreground">
            Every token and component in every state. Source of truth: <code className="font-mono text-base">docs/design.md</code>.
            Resize to 375px and toggle the theme to review.
          </p>
        </header>

        <div className="space-y-20">
          <Foundations />
          <Primitives />
          <SearchBarSection />
          <FilterChipSection />
          <CandidateRowSection />
          <ResultsSection />
          <SheetSection />
          <StatesSection />
          <PlanSection
            plan={plan}
            setPlan={setPlan}
            openUpgrade={(reason) => setUpgrade({ open: true, reason })}
          />
          <ToastSection />
          <Block title="AppShell · sidebar" note="The frame around this page. Switch the sidebar list state below; at < 768px the sidebar becomes the top bar + bottom tab bar.">
            <Segmented
              value={sidebarState}
              onChange={setSidebarState}
              options={["success", "pending", "empty", "error"]}
            />
          </Block>
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
    <section id={id} aria-labelledby={`${id}-h`} className="scroll-mt-20">
      <h2 id={`${id}-h`} className="mb-6 border-b border-border pb-3 text-xl font-semibold">
        {title}
      </h2>
      <div className="space-y-10">{children}</div>
    </section>
  )
}

function Block({ title, note, children, className }: { title: string; note?: string; children: React.ReactNode; className?: string }) {
  return (
    <div>
      <h3 className="text-base font-medium">{title}</h3>
      {note && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{note}</p>}
      <div className={cn("mt-4", className)}>{children}</div>
    </div>
  )
}

function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: readonly T[] }) {
  return (
    <div role="radiogroup" className="inline-flex flex-wrap rounded-md border border-border p-0.5">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          role="radio"
          aria-checked={value === o}
          onClick={() => onChange(o)}
          className={cn(
            "h-7 rounded-[4px] px-2.5 text-sm text-muted-foreground capitalize transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50",
            value === o && "bg-accent font-medium text-foreground",
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
              <li key={i} className="flex h-8 items-center gap-2 px-2">
                <Skeleton className="size-4" />
                <Skeleton className={cn("h-3.5", i === 1 ? "w-24" : "w-32")} />
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
          <li className="px-2 py-1 text-sm text-muted-foreground">Bookmark a candidate to start a list.</li>
        </SidebarSection>
        <SidebarSection title="Saved searches">
          <li className="px-2 py-1 text-sm text-muted-foreground">Save a search to re-run it later.</li>
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
  ["3xl · 32/38 · semibold", "text-3xl font-semibold", "Find the right people"],
  ["2xl · 24/30 · semibold", "text-2xl font-semibold", "Platform hires Q4"],
  ["xl · 20/28 · semibold", "text-xl font-semibold", "Amara Cohen"],
  ["lg · 16/24", "text-lg", "Search input, dialog body on mobile"],
  ["base · 14/20 (body)", "text-base", "DevOps Engineer at Copperline"],
  ["sm · 13/18", "text-sm", "New York, NY · 4 yrs"],
  ["xs · 12/16", "text-xs", "Section labels, counts, badges"],
] as const

function Foundations() {
  return (
    <Section id="foundations" title="Foundations">
      <Block title="Grey ramp" note="One cool grey, 11 steps. Components use semantic roles, not ramp steps.">
        <div className="grid grid-cols-6 gap-2 sm:grid-cols-11">
          {RAMP.map((step) => (
            <div key={step} className="space-y-1.5">
              <div className="h-12 rounded-md border border-border" style={{ background: `var(--gray-${step})` }} />
              <p className="font-mono text-xs text-muted-foreground">{step}</p>
            </div>
          ))}
        </div>
      </Block>
      <Block title="Semantic roles" note="Primary is the only accent — primary action, focus ring, selection. Status colours appear only as text or subtle tints.">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {ROLES.map(([name, cls]) => (
            <div key={name} className="flex items-center gap-2.5">
              <span className={cn("size-8 shrink-0 rounded-md border border-border", cls)} />
              <span className="text-sm">{name}</span>
            </div>
          ))}
        </div>
      </Block>
      <Block title="Type" note="Geist Sans / Geist Mono. Tight UI line-heights; tabular numbers for counts.">
        <div className="divide-y divide-border rounded-lg border border-border">
          {TYPE.map(([label, cls, sample]) => (
            <div key={label} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-baseline sm:gap-6">
              <span className="w-48 shrink-0 font-mono text-xs text-muted-foreground">{label}</span>
              <span className={cn("truncate", cls)}>{sample}</span>
            </div>
          ))}
          <div className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-baseline sm:gap-6">
            <span className="w-48 shrink-0 font-mono text-xs text-muted-foreground">mono · tabular-nums</span>
            <span className="font-mono tabular-nums">1,234 candidates · 0123456789</span>
          </div>
        </div>
      </Block>
      <Block title="Radii, elevation, spacing">
        <div className="grid gap-6 sm:grid-cols-3">
          <div className="flex items-end gap-3">
            {[["6", "rounded-md"], ["10", "rounded-lg"], ["14", "rounded-xl"]].map(([px, cls]) => (
              <div key={px} className="text-center">
                <div className={cn("size-14 border border-border-strong bg-surface", cls)} />
                <p className="mt-1.5 font-mono text-xs text-muted-foreground">{px}px</p>
              </div>
            ))}
          </div>
          <div className="flex items-end gap-4">
            <div className="text-center">
              <div className="size-14 rounded-lg border border-border bg-card" />
              <p className="mt-1.5 text-xs text-muted-foreground">Hairline</p>
            </div>
            <div className="text-center">
              <div className="size-14 rounded-lg bg-popover shadow-lg" />
              <p className="mt-1.5 text-xs text-muted-foreground">Overlay</p>
            </div>
          </div>
          <div className="flex items-end gap-1.5">
            {[1, 2, 3, 4, 6, 8, 12].map((n) => (
              <div key={n} className="text-center">
                <div className="w-4 rounded-[2px] bg-primary-subtle" style={{ height: n * 4 }} />
                <p className="mt-1.5 font-mono text-[10px] text-muted-foreground">{n * 4}</p>
              </div>
            ))}
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
      <Block title="Button" note="One primary (accent) button per view. Outline for secondary, ghost for toolbars and icon buttons.">
        <div className="flex flex-wrap items-center gap-3">
          <Button>Search</Button>
          <Button variant="outline">Save search</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Delete list</Button>
          <Button variant="link">Link</Button>
          <Button disabled>Disabled</Button>
          <Button size="sm" variant="outline">Small</Button>
          <Button size="icon" variant="ghost" aria-label="Bookmark"><BookmarkIcon /></Button>
        </div>
      </Block>
      <Block title="Badge · Tag · Kbd" note="Badge = status (text + tint). Tag = neutral data (skills); matched tags take the accent tint. Kbd = shortcut hint, hidden on touch.">
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

/* ——— SearchBar ——— */

function SearchBarSection() {
  const [value, setValue] = useState("")
  const [loading, setLoading] = useState(false)
  const submit = useCallback(() => {
    setLoading(true)
    setTimeout(() => setLoading(false), 1500)
  }, [])
  const noop = useCallback(() => {}, [])
  return (
    <Section id="search-bar" title="SearchBar">
      <Block title="Interactive" note="⌘K or / focuses. Enter submits, Shift+Enter adds a line, Esc blurs. Grows with content; counter appears near the 500-char limit.">
        <SearchBar value={value} onChange={setValue} onSubmit={submit} loading={loading} />
      </Block>
      <Block title="Filled">
        <SearchBar value="Senior backend engineers in Seattle with Go and Kubernetes, 5+ years" onChange={noop} onSubmit={noop} globalShortcut={false} />
      </Block>
      <Block title="Loading">
        <SearchBar value="Staff data engineers at startups" onChange={noop} onSubmit={noop} loading globalShortcut={false} />
      </Block>
      <Block title="Disabled (no searches left)">
        <SearchBar value="" onChange={noop} onSubmit={noop} disabled globalShortcut={false} placeholder="Upgrade to run another search" />
      </Block>
      <Block title="Error">
        <SearchBar value="Designers in Paris" onChange={noop} onSubmit={noop} error="Search is unavailable right now. Try again in a moment." globalShortcut={false} />
      </Block>
      <Block title="Too long">
        <SearchBar value={"Senior engineers ".repeat(32)} onChange={noop} onSubmit={noop} globalShortcut={false} />
      </Block>
    </Section>
  )
}

/* ——— FilterChip ——— */

type DemoFilter = { key: string; label: string; values: string[] }

function FilterChipSection() {
  const [filters, setFilters] = useState<DemoFilter[]>([
    { key: "role", label: "Role", values: ["Backend Engineer"] },
    { key: "seniority", label: "Seniority", values: ["Senior", "Staff"] },
    { key: "location", label: "Location", values: ["Seattle"] },
    { key: "years", label: "Experience", values: ["5+ yrs"] },
    { key: "skills", label: "Skills", values: ["Go", "Kubernetes"] },
  ])

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
    <Section id="filter-chips" title="FilterChip">
      <Block title="Interactive" note="Label · value. Click to edit (Location opens the option editor), × removes with Undo. Open chip = accent border.">
        <FilterChipList>
          {filters.map((f) => (
            <FilterChip
              key={f.key}
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
      </Block>
      <Block title="States">
        <FilterChipList>
          <FilterChip label="Location" value="New York" onRemove={() => {}} />
          <FilterChip label="Open to work" value="Yes" />
          <FilterChip label="Salary" value="$200k+" unsupported onRemove={() => {}} />
          <FilterChip label="Seniority" value="Senior" disabled onRemove={() => {}} />
          <FilterChip label="Skills" value="React, TypeScript, GraphQL, Node.js, PostgreSQL" onRemove={() => {}} className="max-w-64" />
        </FilterChipList>
        <p className="mt-3 text-sm text-muted-foreground">Default · read-only · unsupported (not applied) · disabled · truncated</p>
      </Block>
      <Block title="Loading">
        <FilterChipsSkeleton />
      </Block>
    </Section>
  )
}

/* ——— CandidateRow ——— */

function CandidateRowSection() {
  const [shortlisted, setShortlisted] = useState<Set<string>>(() => new Set([STAFF.id]))
  const [selected, setSelected] = useState<string | null>(OPEN.id)
  const matched = useMemo(() => new Set(["React", "TypeScript", "Kotlin", "Go"]), [])
  const toggle = useCallback(
    (id: string) => {
      const next = new Set(shortlisted)
      if (next.has(id)) {
        next.delete(id)
        toastUndo("Removed from Platform hires Q4", () => setShortlisted((p) => new Set(p).add(id)))
      } else {
        next.add(id)
        toast.success("Added to Platform hires Q4")
      }
      setShortlisted(next)
    },
    [shortlisted],
  )

  return (
    <Section id="candidate-row" title="CandidateRow">
      <Block title="States" note="Default · shortlisted · selected (open in sheet) · open to work · shortlist pending · image fallback + truncation. Hover and keyboard focus tint the row.">
        <CandidateList>
          {[AMARA, STAFF, OPEN, JUNIOR, LONG].map((c, i) => (
            <CandidateRow
              key={c.id}
              candidate={c}
              rank={i + 1}
              onOpen={setSelected}
              selected={selected === c.id}
              shortlisted={shortlisted.has(c.id)}
              shortlistPending={c.id === JUNIOR.id}
              onToggleShortlist={toggle}
              matchedSkills={matched}
              priority={i < 2}
            />
          ))}
        </CandidateList>
      </Block>
      <Block title="Loading">
        <CandidateList>
          <CandidateRowSkeleton />
          <CandidateRowSkeleton />
        </CandidateList>
      </Block>
    </Section>
  )
}

/* ——— Results (all four data-view states) ——— */

function ResultsSection() {
  const [state, setState] = useState<ListState>("success")
  const noop = useCallback(() => {}, [])
  return (
    <Section id="results" title="Result list · data-view states">
      <Block title="Ranked results" note="Every data view handles loading, empty, error and success. Count is announced politely.">
        <div className="mb-4">
          <Segmented value={state} onChange={setState} options={["success", "pending", "empty", "unsupported", "error"]} />
        </div>
        <p aria-live="polite" className="mb-3 text-sm text-muted-foreground tabular-nums">
          {state === "success" ? "1,284 candidates · best match first" : state === "pending" ? "Searching…" : " "}
        </p>
        {state === "success" && (
          <CandidateList>
            {FIXTURE_CANDIDATES.map((c, i) => (
              <CandidateRow key={c.id} candidate={c} rank={i + 1} onOpen={noop} onToggleShortlist={noop} />
            ))}
          </CandidateList>
        )}
        {state === "pending" && <CandidateListSkeleton rows={4} />}
        {state === "empty" && (
          <CandidateList>
            <EmptyState
              icon={SearchXIcon}
              title="No one matches every filter."
              description="Remove a filter or widen the experience range."
              action={<Button variant="outline">Edit filters</Button>}
            />
          </CandidateList>
        )}
        {state === "unsupported" && (
          <CandidateList>
            <EmptyState
              icon={SearchXIcon}
              title="We can't search by salary."
              description="Candidate records don't include compensation, so we returned no one rather than guess. Remove it to search the rest."
              action={<Button variant="outline">Remove salary</Button>}
            />
          </CandidateList>
        )}
        {state === "error" && (
          <CandidateList>
            <ErrorState message="We couldn't load this page of results." onRetry={() => toast("Retrying…")} />
          </CandidateList>
        )}
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
      <Block title="Side sheet ≥ 768px · bottom drawer below" note="Opened on demand — feature code imports it with next/dynamic.">
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
        actions={
          <>
            <Button onClick={() => toast.success("Added to Platform hires Q4")}>
              <BookmarkIcon /> Add to shortlist
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
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-border">
          <EmptyState icon={UsersIcon} title="This shortlist is empty." action={<Button variant="outline">Find candidates</Button>} />
        </div>
        <div className="rounded-lg border border-border">
          <ErrorState message="The server didn't respond. Your shortlists are safe." onRetry={() => {}} />
        </div>
        <div className="rounded-lg border border-border">
          <EmptyState size="compact" icon={InboxIcon} title="No saved searches yet." action={<Button size="sm" variant="ghost">Save this search</Button>} />
        </div>
        <div className="space-y-3 rounded-lg border border-border p-4">
          <ErrorState variant="inline" message="Couldn't load lists" onRetry={() => {}} />
          <ErrorState variant="inline" message="Retrying…" onRetry={() => {}} retrying />
        </div>
      </div>
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
      <Block title="PlanBadge" note="Free plans open the UpgradeDialog; paid is static. The sidebar badge follows the selection below.">
        <div className="flex flex-wrap items-center gap-3">
          <PlanBadge plan={{ plan: "free", searches_remaining: 1 }} onClick={() => openUpgrade("manual")} />
          <PlanBadge plan={{ plan: "free", searches_remaining: 0 }} onClick={() => openUpgrade("quota")} />
          <PlanBadge plan={{ plan: "paid", searches_remaining: null }} />
          <PlanBadge plan={undefined} />
        </div>
        <div className="mt-4">
          <Segmented
            value={plan.plan === "paid" ? "paid" : plan.searches_remaining ? "free · 1" : "free · 0"}
            onChange={(v) =>
              setPlan(v === "paid" ? { plan: "paid", searches_remaining: null } : { plan: "free", searches_remaining: v === "free · 1" ? 1 : 0 })
            }
            options={["free · 1", "free · 0", "paid"]}
          />
        </div>
      </Block>
      <Block title="UpgradeDialog" note="Dialog ≥ 768px, drawer below. Opened by a 402 (quota) or the badge (manual). No checkout — plan changes arrive via billing webhook.">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => openUpgrade("quota")}>After 402</Button>
          <Button variant="outline" onClick={() => openUpgrade("manual")}>From badge</Button>
        </div>
      </Block>
    </Section>
  )
}

/* ——— Toasts ——— */

function ToastSection() {
  return (
    <Section id="toasts" title="Toasts">
      <Block title="sonner" note="Confirmations are quiet; destructive actions happen immediately and offer Undo for 6 s. Errors say what failed.">
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
