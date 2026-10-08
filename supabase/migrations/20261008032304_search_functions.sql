-- Search: public.run_search (atomic quota + ranked snapshot) and public.search_page (snapshot paging).
--
-- See CLAUDE.md "Search rules" and docs/decisions.md ("Search: find & rank").
--   * run_search is the only way a search row is created. It locks the company row, consumes the free quota and
--     stores the ranked id snapshot in one transaction, so calling it directly through PostgREST can't bypass the
--     free limit.
--   * Every filter is read into a typed local and used in ONE static query. No dynamic SQL; input values are only
--     ever compared, never executed.
--   * search_page is security invoker: RLS on searches (searches_select_own) limits it to the caller's company.

-- jsonb array of strings -> text[]; null when the key is absent or null. A non-array raises 22023.
create function private.jsonb_text_array(arr jsonb)
returns text[]
language sql
immutable
parallel safe
set search_path = ''
as $$
  select case
    when arr is null or arr = 'null'::jsonb then null
    else (select pg_catalog.array_agg(e.value order by e.ordinality)
          from pg_catalog.jsonb_array_elements_text(arr) with ordinality as e(value, ordinality))
  end
$$;

revoke execute on function private.jsonb_text_array(jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------------------
-- run_search
-- ---------------------------------------------------------------------------------------------------------
create function public.run_search(p_brief text, p_filters jsonb)
returns table (search_id uuid, total integer, searches_remaining integer)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  -- Mirrors FREE_SEARCH_LIMIT in src/lib/plan.ts.
  c_free_limit constant integer := 1;

  v_user      uuid := (select auth.uid());
  v_company   uuid;
  v_brief     text := pg_catalog.btrim(p_brief);
  v_used      integer;
  v_paid      boolean;

  v_roles         text[];
  v_seniority     text[];
  v_years_min     integer;
  v_years_max     integer;
  v_cities        text[];
  v_states        text[];
  v_open          boolean;
  v_skills_all    text[];
  v_skills_any    text[];
  v_requested     text[];
  v_companies     text[];
  v_company_scope text;
  v_ctype         text;
  v_ctype_scope   text;
  v_degrees       text[];
  v_schools       text[];
  v_fields        text[];
  v_prefs         text[];
  v_unsupported   integer;
  v_searchable    boolean;

  v_ids       text[] := '{}'::text[];
  v_total     integer := 0;
  v_search_id uuid;
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  v_company := (select private.current_company_id());
  if v_company is null then
    raise exception 'not a recruiter' using errcode = '42501';
  end if;

  -- ---- Validate and read filters (any error aborts the whole transaction: nothing is consumed) ------
  if v_brief is null or pg_catalog.char_length(v_brief) not between 1 and 500 then
    raise exception 'brief must be 1-500 characters' using errcode = '22023';
  end if;
  if p_filters is null or pg_catalog.jsonb_typeof(p_filters) <> 'object' then
    raise exception 'filters must be a JSON object' using errcode = '22023';
  end if;

  begin
    v_roles       := private.jsonb_text_array(p_filters -> 'roles');
    v_seniority   := private.jsonb_text_array(p_filters -> 'seniority');
    v_years_min   := (p_filters -> 'years_experience' ->> 'min')::integer;
    v_years_max   := (p_filters -> 'years_experience' ->> 'max')::integer;
    v_open        := (p_filters ->> 'open_to_work')::boolean;
    v_skills_all  := private.lower_texts(private.jsonb_text_array(p_filters -> 'skills_all'));
    v_skills_any  := private.lower_texts(private.jsonb_text_array(p_filters -> 'skills_any'));
    v_companies   := private.lower_texts(private.jsonb_text_array(p_filters -> 'companies' -> 'names'));
    v_company_scope := coalesce(p_filters -> 'companies' ->> 'scope', 'any');
    v_ctype       := p_filters -> 'company_type' ->> 'value';
    v_ctype_scope := coalesce(p_filters -> 'company_type' ->> 'scope', 'any');
    v_degrees     := private.jsonb_text_array(p_filters -> 'degrees');
    v_schools     := private.lower_texts(private.jsonb_text_array(p_filters -> 'schools'));
    v_fields      := private.lower_texts(private.jsonb_text_array(p_filters -> 'fields_of_study'));
    v_prefs       := private.lower_texts(private.jsonb_text_array(p_filters -> 'preferences'));
    v_unsupported := coalesce(pg_catalog.cardinality(private.jsonb_text_array(p_filters -> 'unsupported')), 0);

    if p_filters -> 'locations' is not null and p_filters -> 'locations' <> 'null'::jsonb then
      select pg_catalog.array_agg(pg_catalog.lower(l.value ->> 'city')) filter (where l.value ? 'city'),
             pg_catalog.array_agg(pg_catalog.upper(l.value ->> 'state')) filter (where l.value ? 'state')
        into v_cities, v_states
        from pg_catalog.jsonb_array_elements(p_filters -> 'locations') as l(value);
    end if;
  exception
    when invalid_parameter_value or invalid_text_representation or numeric_value_out_of_range
      or cannot_coerce or datatype_mismatch then
      raise exception 'filters are malformed' using errcode = '22023';
  end;

  if v_company_scope not in ('any', 'current') or v_ctype_scope not in ('any', 'current') then
    raise exception 'scope must be any or current' using errcode = '22023';
  end if;

  -- Empty arrays mean "no constraint" (lower_texts turns null into '{}').
  if pg_catalog.cardinality(v_roles)      = 0 then v_roles      := null; end if;
  if pg_catalog.cardinality(v_seniority)  = 0 then v_seniority  := null; end if;
  if pg_catalog.cardinality(v_cities)     = 0 then v_cities     := null; end if;
  if pg_catalog.cardinality(v_states)     = 0 then v_states     := null; end if;
  if pg_catalog.cardinality(v_skills_all) = 0 then v_skills_all := null; end if;
  if pg_catalog.cardinality(v_skills_any) = 0 then v_skills_any := null; end if;
  if pg_catalog.cardinality(v_companies)  = 0 then v_companies  := null; end if;
  if pg_catalog.cardinality(v_degrees)    = 0 then v_degrees    := null; end if;
  if pg_catalog.cardinality(v_schools)    = 0 then v_schools    := null; end if;
  if pg_catalog.cardinality(v_fields)     = 0 then v_fields     := null; end if;
  if pg_catalog.cardinality(v_prefs)      = 0 then v_prefs      := null; end if;
  v_requested := pg_catalog.array_cat(v_skills_all, v_skills_any);

  -- "Never return everyone": at least one constraint, and nothing material left unsupported. The server's
  -- normalizer puts nice-to-haves in `preferences`, so anything in `unsupported` is a material requirement.
  v_searchable := v_unsupported = 0 and (
    v_roles is not null or v_seniority is not null or v_years_min is not null or v_years_max is not null
    or v_cities is not null or v_states is not null or v_open is not null or v_skills_all is not null
    or v_skills_any is not null or v_companies is not null or v_ctype is not null or v_degrees is not null
    or v_schools is not null or v_fields is not null
  );

  -- ---- Quota: lock the company row so concurrent searches serialize ---------------------------------
  select c.searches_used into v_used
    from public.companies c
   where c.id = v_company
     for update;
  v_paid := private.company_is_paid(v_company);
  if not v_paid and v_used >= c_free_limit then
    -- PT402: PostgREST answers HTTP 402; the API service maps this code to payment_required.
    raise exception 'free plan search limit reached' using errcode = 'PT402';
  end if;

  -- ---- Match and rank ----------------------------------------------------------------------------------
  if v_searchable then
    with matched as (
      select c.id, c.skills, c.skills_key, c.companies_key, c.company_types, c.schools_key, c.fields_key,
             c.degrees, c.experiences, c.open_to_work, c.years_experience
        from public.candidates c
       where (v_roles is null or c.role = any (v_roles))
         and (v_seniority is null or c.seniority = any (v_seniority))
         and (v_years_min is null or c.years_experience >= v_years_min)
         and (v_years_max is null or c.years_experience <= v_years_max)
         and ((v_cities is null and v_states is null)
              or c.city_key = any (v_cities) or c.state_key = any (v_states))
         and (v_open is null or c.open_to_work = v_open)
         and (v_skills_all is null or c.skills_key @> v_skills_all)
         and (v_skills_any is null or c.skills_key && v_skills_any)
         and (v_companies is null or case
               when v_company_scope = 'current' then pg_catalog.lower(c.current_company) = any (v_companies)
               else c.companies_key && v_companies end)
         and (v_ctype is null or case
               when v_ctype_scope = 'current' then c.current_company_type = v_ctype
               else c.company_types @> array[v_ctype] end)
         and (v_degrees is null or c.degrees && v_degrees)
         and (v_schools is null or c.schools_key && v_schools)
         and (v_fields is null or c.fields_key && v_fields)
    ),
    scored as (
      select m.id,
        -- skill coverage for "X or Y"
        3 * (select pg_catalog.count(*) from pg_catalog.unnest(v_skills_any) s where s = any (m.skills_key))
        -- nice-to-haves: only ever add to the score, never filter
        + 3 * (select pg_catalog.count(*) from pg_catalog.unnest(v_prefs) p
                where p = any (m.skills_key) or p = any (m.companies_key) or p = any (m.company_types)
                   or p = any (m.schools_key) or p = any (m.fields_key)
                   or p = any (private.lower_texts(m.degrees)))
        -- requested skills that are among the candidate's primary (headline) skills
        + 2 * (select pg_catalog.count(*) from pg_catalog.unnest(private.lower_texts(m.skills[1:3])) s
                where s = any (v_requested))
        -- recency of the matching experience: current job 3, previous 2, older 1
        + case when v_companies is null and v_ctype is null then 0 else coalesce((
            select 3 - least(2, pg_catalog.min(e.ord) - 1)
              from pg_catalog.jsonb_array_elements(m.experiences) with ordinality as e(x, ord)
             where (v_companies is null or pg_catalog.lower(e.x ->> 'company') = any (v_companies))
               and (v_ctype is null or e.x ->> 'company_type' = v_ctype)), 0) end
        + case when v_open is null and m.open_to_work then 1 else 0 end
        -- < 1 in total: orders equal scores by experience, never outweighs a signal above
        + m.years_experience / 100.0 as score
      from matched m
    )
    select coalesce(pg_catalog.array_agg(s.id order by s.score desc, s.id collate "C"), '{}'::text[]),
           pg_catalog.count(*)::integer
      into v_ids, v_total
      from scored s;
  end if;

  -- ---- Store the snapshot and consume the search -------------------------------------------------------
  insert into public.searches (company_id, recruiter_id, brief, filters, result_ids, total)
  values (v_company, v_user, v_brief, p_filters, v_ids, v_total)
  returning id into v_search_id;

  update public.companies c
     set searches_used = c.searches_used + 1
   where c.id = v_company;

  return query select
    v_search_id,
    v_total,
    case when v_paid then null else greatest(0, c_free_limit - (v_used + 1)) end;
end
$$;

revoke execute on function public.run_search(text, jsonb) from public, anon;
grant execute on function public.run_search(text, jsonb) to authenticated;

-- ---------------------------------------------------------------------------------------------------------
-- search_page: 20 summaries from the stored snapshot, in snapshot order (page 1 = first 20)
-- ---------------------------------------------------------------------------------------------------------
create function public.search_page(p_search_id uuid, p_page integer)
returns table (
  ordinal                  bigint,
  id                       text,
  full_name                text,
  headline                 text,
  current_title            text,
  current_company          text,
  current_company_logo_url text,
  avatar_url               text,
  city                     text,
  state                    text,
  country                  text,
  years_experience         integer,
  open_to_work             boolean,
  skills                   text[]
)
language sql
stable
security invoker
set search_path = ''
as $$
  select (p_page - 1) * 20 + r.ord, c.id, c.full_name, c.headline, c.current_title, c.current_company,
         c.current_company_logo_url, c.avatar_url, c.city, c.state, c.country, c.years_experience,
         c.open_to_work, c.skills
    from public.searches s
   cross join lateral pg_catalog.unnest(s.result_ids[(p_page - 1) * 20 + 1 : p_page * 20])
         with ordinality as r(candidate_id, ord)
    join public.candidates c on c.id = r.candidate_id
   where s.id = p_search_id
     and p_page between 1 and 1000000
   order by r.ord
$$;

revoke execute on function public.search_page(uuid, integer) from public, anon;
grant execute on function public.search_page(uuid, integer) to authenticated;
