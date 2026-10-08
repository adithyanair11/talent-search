-- Initial schema: companies, recruiters, candidates, searches, shortlists, saved briefs, billing.
--
-- Tenancy model (see CLAUDE.md "Tenancy & security rules"):
--   * every table has RLS enabled; anon gets nothing, authenticated gets the minimum grant + policy
--   * private.current_company_id() maps auth.uid() -> company and lives in a schema PostgREST does not expose
--   * recruiter-writable tables (shortlists, shortlist_people, saved_briefs) are company-scoped in USING and
--     WITH CHECK, default company_id from the helper, and a trigger forbids changing company_id
--   * server-written tables (companies counters, searches, subscriptions, stripe_events) have no write grants

-- ---------------------------------------------------------------------------------------------------------
-- Private schema (not in config.toml [api].schemas, so never reachable through PostgREST)
-- ---------------------------------------------------------------------------------------------------------
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

-- Immutable helpers used by generated columns on candidates.
create function private.jsonb_texts(arr jsonb, key text)
returns text[]
language sql
immutable
parallel safe
set search_path = ''
as $$
  select coalesce(array_agg(e.value ->> key order by e.ordinality), '{}'::text[])
  from pg_catalog.jsonb_array_elements(arr) with ordinality as e(value, ordinality)
$$;

create function private.lower_texts(arr text[])
returns text[]
language sql
immutable
parallel safe
set search_path = ''
as $$
  select coalesce(array_agg(pg_catalog.lower(t.value) order by t.ordinality), '{}'::text[])
  from pg_catalog.unnest(arr) with ordinality as t(value, ordinality)
$$;

-- ---------------------------------------------------------------------------------------------------------
-- Companies and recruiters
-- ---------------------------------------------------------------------------------------------------------
create table public.companies (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name          text not null check (char_length(name) between 1 and 200),
  searches_used integer not null default 0 check (searches_used >= 0),
  created_at    timestamptz not null default now()
);

create table public.recruiters (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index recruiters_company_id_idx on public.recruiters (company_id);

-- Maps the calling user to their company. Security definer so policies can use it without granting
-- recruiters broader access to public.recruiters. Returns null for anon / unknown users.
create function private.current_company_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select r.company_id
  from public.recruiters r
  where r.user_id = (select auth.uid())
$$;

-- ---------------------------------------------------------------------------------------------------------
-- Candidates (shared across companies, read-only for recruiters)
-- One row per candidate; experiences/education kept as ordered jsonb arrays (newest job first, as in the
-- source data). Every search predicate is a row-level check on a generated column, so search needs no joins
-- and generated values can never drift from the source fields. See docs/decisions.md.
-- ---------------------------------------------------------------------------------------------------------
create table public.candidates (
  id                       text primary key check (id ~ '^cand_[0-9]+$'),
  full_name                text not null,
  avatar_url               text not null,
  headline                 text not null,
  current_title            text not null,
  current_company          text not null,
  current_company_logo_url text not null,
  role                     text not null,
  seniority                text not null check (seniority in ('junior', 'mid', 'senior', 'staff')),
  years_experience         integer not null check (years_experience >= 0),
  city                     text not null,
  state                    text not null,
  country                  text not null,
  open_to_work             boolean not null,
  skills                   text[] not null default '{}',
  experiences              jsonb not null default '[]' check (jsonb_typeof(experiences) = 'array'),
  education                jsonb not null default '[]' check (jsonb_typeof(education) = 'array'),
  created_at               timestamptz not null default now(),

  -- Normalized search keys (lower-cased text, upper-cased state codes).
  skills_key           text[] generated always as (private.lower_texts(skills)) stored,
  city_key             text   generated always as (lower(city)) stored,
  state_key            text   generated always as (upper(state)) stored,
  title_key            text   generated always as (lower(current_title)) stored,
  companies_key        text[] generated always as (private.lower_texts(private.jsonb_texts(experiences, 'company'))) stored,
  company_types        text[] generated always as (private.jsonb_texts(experiences, 'company_type')) stored,
  current_company_type text   generated always as (experiences -> 0 ->> 'company_type') stored,
  degrees              text[] generated always as (private.jsonb_texts(education, 'degree')) stored,
  schools_key          text[] generated always as (private.lower_texts(private.jsonb_texts(education, 'school'))) stored,
  fields_key           text[] generated always as (private.lower_texts(private.jsonb_texts(education, 'field'))) stored
);

create index candidates_role_idx                 on public.candidates (role);
create index candidates_seniority_idx            on public.candidates (seniority);
create index candidates_years_experience_idx     on public.candidates (years_experience);
create index candidates_city_key_idx             on public.candidates (city_key);
create index candidates_state_key_idx            on public.candidates (state_key);
create index candidates_open_to_work_idx         on public.candidates (open_to_work);
create index candidates_current_company_type_idx on public.candidates (current_company_type);
create index candidates_skills_key_gin           on public.candidates using gin (skills_key);
create index candidates_companies_key_gin        on public.candidates using gin (companies_key);
create index candidates_company_types_gin        on public.candidates using gin (company_types);
create index candidates_degrees_gin              on public.candidates using gin (degrees);
create index candidates_schools_key_gin          on public.candidates using gin (schools_key);
create index candidates_fields_key_gin           on public.candidates using gin (fields_key);

-- ---------------------------------------------------------------------------------------------------------
-- Searches (written only by the server / security definer search function)
-- ---------------------------------------------------------------------------------------------------------
create table public.searches (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.companies (id) on delete cascade,
  recruiter_id uuid references public.recruiters (user_id) on delete set null,
  brief        text not null check (char_length(brief) between 1 and 500),
  filters      jsonb not null default '{}' check (jsonb_typeof(filters) = 'object'),
  result_ids   text[] not null default '{}',
  total        integer not null default 0 check (total >= 0),
  created_at   timestamptz not null default now()
);
create index searches_company_created_idx on public.searches (company_id, created_at desc);
create index searches_recruiter_id_idx on public.searches (recruiter_id);

-- ---------------------------------------------------------------------------------------------------------
-- Shortlists
-- ---------------------------------------------------------------------------------------------------------
create table public.shortlists (
  id         uuid primary key default gen_random_uuid(),
  company_id uuid not null default private.current_company_id() references public.companies (id) on delete cascade,
  name       text not null check (name = btrim(name) and char_length(name) between 1 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Target of the composite FK from shortlist_people.
  unique (id, company_id)
);
create unique index shortlists_company_name_key on public.shortlists (company_id, lower(name));

create table public.shortlist_people (
  shortlist_id uuid not null,
  person_id    text not null references public.candidates (id) on delete cascade,
  company_id   uuid not null default private.current_company_id(),
  added_at     timestamptz not null default now(),
  primary key (shortlist_id, person_id),
  -- A row's company must be its shortlist's company.
  foreign key (shortlist_id, company_id) references public.shortlists (id, company_id) on delete cascade
);
create index shortlist_people_person_id_idx on public.shortlist_people (person_id);
create index shortlist_people_company_id_idx on public.shortlist_people (company_id);

-- ---------------------------------------------------------------------------------------------------------
-- Saved briefs
-- ---------------------------------------------------------------------------------------------------------
create table public.saved_briefs (
  id         uuid primary key default gen_random_uuid(),
  company_id uuid not null default private.current_company_id() references public.companies (id) on delete cascade,
  brief      text not null check (char_length(brief) between 1 and 500),
  filters    jsonb not null default '{}' check (jsonb_typeof(filters) = 'object'),
  created_at timestamptz not null default now()
);
create index saved_briefs_company_created_idx on public.saved_briefs (company_id, created_at desc);

-- ---------------------------------------------------------------------------------------------------------
-- Billing (written only by the Stripe webhook via the service role)
-- ---------------------------------------------------------------------------------------------------------
create table public.subscriptions (
  stripe_subscription_id text primary key,
  company_id             uuid not null references public.companies (id) on delete cascade,
  status                 text not null check (status in (
                           'incomplete', 'incomplete_expired', 'trialing', 'active',
                           'past_due', 'canceled', 'unpaid', 'paused')),
  last_event_created     bigint not null,
  last_event_id          text not null,
  updated_at             timestamptz not null default now()
);
create index subscriptions_company_id_idx on public.subscriptions (company_id);

create table public.stripe_events (
  event_id    text primary key,
  type        text not null,
  created     bigint not null,
  received_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------------------------------------
-- Helper functions and triggers
-- ---------------------------------------------------------------------------------------------------------

-- Paid iff the company has at least one active/trialing subscription. Only answers for the caller's own
-- company (or the service role); any other company reads as unpaid.
create function private.company_is_paid(p_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.subscriptions s
    where s.company_id = p_company_id
      and s.status in ('active', 'trialing')
      and (
        p_company_id = (select private.current_company_id())
        or (select auth.role()) = 'service_role'
      )
  )
$$;

create function private.forbid_company_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.company_id is distinct from old.company_id then
    raise exception 'company_id cannot be changed' using errcode = '42501';
  end if;
  return new;
end
$$;

create function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end
$$;

create trigger shortlists_forbid_company_change
  before update on public.shortlists
  for each row execute function private.forbid_company_change();
create trigger shortlists_touch_updated_at
  before update on public.shortlists
  for each row execute function private.touch_updated_at();
create trigger shortlist_people_forbid_company_change
  before update on public.shortlist_people
  for each row execute function private.forbid_company_change();
create trigger saved_briefs_forbid_company_change
  before update on public.saved_briefs
  for each row execute function private.forbid_company_change();

revoke execute on all functions in schema private from public, anon, authenticated;
grant execute on function private.current_company_id() to authenticated, service_role;
grant execute on function private.company_is_paid(uuid) to authenticated, service_role;
-- Generated columns evaluate these during inserts by the service role (seed).
grant execute on function private.jsonb_texts(jsonb, text) to service_role;
grant execute on function private.lower_texts(text[]) to service_role;

-- ---------------------------------------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------------------------------------
alter table public.companies        enable row level security;
alter table public.recruiters       enable row level security;
alter table public.candidates       enable row level security;
alter table public.searches         enable row level security;
alter table public.shortlists       enable row level security;
alter table public.shortlist_people enable row level security;
alter table public.saved_briefs     enable row level security;
alter table public.subscriptions    enable row level security;
alter table public.stripe_events    enable row level security;

-- Recruiter-writable tenant tables: RLS applies even to the table owner.
alter table public.shortlists       force row level security;
alter table public.shortlist_people force row level security;
alter table public.saved_briefs     force row level security;

-- Start from nothing, then grant the minimum (Supabase grants ALL on public tables by default).
revoke all on public.companies, public.recruiters, public.candidates, public.searches, public.shortlists,
  public.shortlist_people, public.saved_briefs, public.subscriptions, public.stripe_events
  from anon, authenticated;

grant select on public.companies, public.recruiters, public.candidates, public.searches,
  public.subscriptions to authenticated;
grant select, delete on public.shortlists, public.shortlist_people, public.saved_briefs to authenticated;
-- Column-level write grants: company_id / ids / timestamps can never be supplied by a recruiter.
grant insert (name), update (name) on public.shortlists to authenticated;
grant insert (shortlist_id, person_id) on public.shortlist_people to authenticated;
grant insert (brief, filters), update (brief, filters) on public.saved_briefs to authenticated;

create policy companies_select_own on public.companies
  for select to authenticated
  using (id = (select private.current_company_id()));

create policy recruiters_select_self on public.recruiters
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy candidates_select_all on public.candidates
  for select to authenticated
  using (true);

create policy searches_select_own on public.searches
  for select to authenticated
  using (company_id = (select private.current_company_id()));

create policy subscriptions_select_own on public.subscriptions
  for select to authenticated
  using (company_id = (select private.current_company_id()));

-- stripe_events: no policies -> invisible to anon/authenticated.

create policy shortlists_select_own on public.shortlists
  for select to authenticated
  using (company_id = (select private.current_company_id()));
create policy shortlists_insert_own on public.shortlists
  for insert to authenticated
  with check (company_id = (select private.current_company_id()));
create policy shortlists_update_own on public.shortlists
  for update to authenticated
  using (company_id = (select private.current_company_id()))
  with check (company_id = (select private.current_company_id()));
create policy shortlists_delete_own on public.shortlists
  for delete to authenticated
  using (company_id = (select private.current_company_id()));

create policy shortlist_people_select_own on public.shortlist_people
  for select to authenticated
  using (company_id = (select private.current_company_id()));
create policy shortlist_people_insert_own on public.shortlist_people
  for insert to authenticated
  with check (company_id = (select private.current_company_id()));
create policy shortlist_people_delete_own on public.shortlist_people
  for delete to authenticated
  using (company_id = (select private.current_company_id()));

create policy saved_briefs_select_own on public.saved_briefs
  for select to authenticated
  using (company_id = (select private.current_company_id()));
create policy saved_briefs_insert_own on public.saved_briefs
  for insert to authenticated
  with check (company_id = (select private.current_company_id()));
create policy saved_briefs_update_own on public.saved_briefs
  for update to authenticated
  using (company_id = (select private.current_company_id()))
  with check (company_id = (select private.current_company_id()));
create policy saved_briefs_delete_own on public.saved_briefs
  for delete to authenticated
  using (company_id = (select private.current_company_id()));
