-- Stripe webhook: apply one verified event to public.stripe_events + public.subscriptions atomically.
-- Called only by the billing route through the service-role client (see docs/decisions.md "Billing").
--
-- Rules (CLAUDE.md "Plan & billing rules", docs/data-notes.md §5):
--   * dedupe on event.id: stripe_events insert ON CONFLICT DO NOTHING -> repeat = 'duplicate'
--   * only customer.subscription.* events carry subscription state; anything else -> 'ignored'
--   * company from data.object.metadata.company (slug); unknown/missing -> 'ignored'
--   * a subscription row changes only when event.created is newer than the stored one;
--     tie -> canceled wins, then the larger event id; 'canceled' is terminal for that subscription id
--   * paid iff any subscription is active/trialing (private.company_is_paid, unchanged)

create function private.apply_stripe_event(event jsonb)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event_id   text;
  v_type       text;
  v_created    bigint;
  v_object     jsonb;
  v_sub_id     text;
  v_status     text;
  v_company_id uuid;
  v_existing   public.subscriptions%rowtype;
  v_inserted   integer;
begin
  -- Service-role only (no recruiter has a company to check here). EXECUTE is also granted only to service_role.
  if (select auth.role()) is distinct from 'service_role' then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  if event is null or jsonb_typeof(event) <> 'object'
     or jsonb_typeof(event -> 'id') is distinct from 'string'
     or jsonb_typeof(event -> 'type') is distinct from 'string'
     or jsonb_typeof(event -> 'created') is distinct from 'number' then
    raise exception 'malformed event' using errcode = '22023';
  end if;

  v_event_id := event ->> 'id';
  v_type     := event ->> 'type';
  if char_length(v_event_id) not between 1 and 255 or char_length(v_type) not between 1 and 255
     or (event ->> 'created') !~ '^[0-9]{1,15}$' then
    raise exception 'malformed event' using errcode = '22023';
  end if;
  v_created := (event ->> 'created')::bigint;

  insert into public.stripe_events (event_id, type, created)
  values (v_event_id, v_type, v_created)
  on conflict (event_id) do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then
    return 'duplicate';
  end if;

  if v_type not like 'customer.subscription.%' then
    return 'ignored';
  end if;

  v_object := event #> '{data,object}';
  if v_object is null or jsonb_typeof(v_object) <> 'object' then
    return 'ignored';
  end if;

  v_sub_id := v_object ->> 'id';
  v_status := case when v_type = 'customer.subscription.deleted' then 'canceled' else v_object ->> 'status' end;
  if v_sub_id is null or char_length(v_sub_id) not between 1 and 255
     or v_status is null or v_status not in (
       'incomplete', 'incomplete_expired', 'trialing', 'active', 'past_due', 'canceled', 'unpaid', 'paused') then
    return 'ignored';
  end if;

  select c.id into v_company_id
  from public.companies c
  where c.slug = (v_object #>> '{metadata,company}');
  if v_company_id is null then
    return 'ignored';
  end if;

  -- Serialize concurrent deliveries for the same subscription.
  select * into v_existing
  from public.subscriptions s
  where s.stripe_subscription_id = v_sub_id
  for update;

  if not found then
    insert into public.subscriptions (stripe_subscription_id, company_id, status, last_event_created, last_event_id)
    values (v_sub_id, v_company_id, v_status, v_created, v_event_id)
    on conflict (stripe_subscription_id) do nothing;
    get diagnostics v_inserted = row_count;
    if v_inserted = 1 then
      return 'applied';
    end if;
    -- Lost a race with a concurrent first insert: lock the winner and compare like any other update.
    select * into v_existing
    from public.subscriptions s
    where s.stripe_subscription_id = v_sub_id
    for update;
  end if;

  if v_existing.company_id <> v_company_id
     or v_existing.status = 'canceled'
     or v_created < v_existing.last_event_created
     or (v_created = v_existing.last_event_created
         and not (v_status = 'canceled'
                  or v_event_id collate "C" > v_existing.last_event_id collate "C")) then
    return 'stale';
  end if;

  update public.subscriptions s
  set status = v_status,
      last_event_created = v_created,
      last_event_id = v_event_id,
      updated_at = now()
  where s.stripe_subscription_id = v_sub_id;
  return 'applied';
end
$$;

revoke execute on function private.apply_stripe_event(jsonb) from public, anon, authenticated;
grant execute on function private.apply_stripe_event(jsonb) to service_role;

-- PostgREST only exposes `public`, so the webhook reaches the private function through this wrapper.
create function public.apply_stripe_event(event jsonb)
returns text
language sql
security invoker
set search_path = ''
as $$
  select private.apply_stripe_event(event)
$$;

revoke execute on function public.apply_stripe_event(jsonb) from public, anon, authenticated;
grant execute on function public.apply_stripe_event(jsonb) to service_role;
