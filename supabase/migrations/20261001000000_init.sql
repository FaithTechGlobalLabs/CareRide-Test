-- CareRide schema. Create the project in the Canada (Central) region, ca-central-1.
-- Principle: collect the minimum, and let partners see only what they need.

-- ── Organizations and people ────────────────────────────────────────────────

create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null check (type in ('salvation_army', 'partner')),
  service_area text not null default '',
  capabilities text[] not null default '{}',
  offers_free boolean not null default false,
  offers_paid boolean not null default false,
  contact_email text,
  contact_phone text
);

create table profiles (
  id uuid primary key references auth.users on delete cascade,
  org_id uuid not null references organizations,
  name text not null,
  email text not null,
  phone text,
  role text not null check (role in ('staff', 'coordinator', 'partner'))
);

-- Helpers used by policies. SECURITY DEFINER so they can read profiles without recursing into RLS.
create function my_org_id() returns uuid language sql stable security definer set search_path = public as
  $$ select org_id from profiles where id = auth.uid() $$;
create function my_role() returns text language sql stable security definer set search_path = public as
  $$ select role from profiles where id = auth.uid() $$;
create function is_staff() returns boolean language sql stable security definer set search_path = public as
  $$ select coalesce(my_role() in ('staff', 'coordinator'), false) $$;

-- ── Riders: first name + last initial only. No DOB, health numbers or diagnoses. ──

create table riders (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations,
  display_name text not null check (char_length(display_name) <= 40),
  language text not null default 'English',
  needs text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table places (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations,
  name text not null,
  address text not null,
  type text not null check (type in ('hospital', 'shelter', 'clinic', 'court', 'office', 'other'))
);

create table funding_sources (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations,
  name text not null,
  monthly_budget_cents integer not null default 0
);

-- ── Rides ──────────────────────────────────────────────────────────────────

create table ride_requests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations,
  rider_id uuid not null references riders on delete cascade,
  leg text not null default 'outbound' check (leg in ('outbound', 'return')),
  parent_id uuid references ride_requests on delete cascade,
  pickup_name text not null,
  pickup_address text not null,
  dropoff_name text not null,
  dropoff_address text not null,
  dropoff_type text not null default 'other',
  pickup_at timestamptz not null,
  appointment_at timestamptz,
  needs text[] not null default '{}',
  payment_type text not null check (payment_type in ('free', 'paid')),
  funding_source_id uuid references funding_sources,
  cost_cap_cents integer,
  driver_notes text not null default '' check (char_length(driver_notes) <= 500),
  contact_phone text not null,
  status text not null default 'requested' check (status in
    ('requested', 'accepted', 'driver_assigned', 'picked_up', 'dropped_off', 'completed', 'cancelled', 'no_show')),
  partner_org_id uuid references organizations,
  driver_name text,
  driver_phone text,
  driver_token text unique,
  driver_token_expires_at timestamptz,
  consent_at timestamptz not null,
  created_by uuid not null references profiles,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (payment_type = 'free' or funding_source_id is not null)
);
create index on ride_requests (org_id, pickup_at);
create index on ride_requests (partner_org_id, pickup_at);
create index on ride_requests (status) where status = 'requested';

create table ride_events (
  id uuid primary key default gen_random_uuid(),
  ride_id uuid not null references ride_requests on delete cascade,
  actor_kind text not null check (actor_kind in ('staff', 'partner', 'driver', 'system')),
  actor_name text not null,
  from_status text,
  to_status text not null,
  note text,
  created_at timestamptz not null default now()
);
create index on ride_events (ride_id, created_at);

create table partner_declines (
  ride_id uuid not null references ride_requests on delete cascade,
  partner_org_id uuid not null references organizations,
  reason text not null default '',
  created_at timestamptz not null default now(),
  primary key (ride_id, partner_org_id)
);

create function touch_updated_at() returns trigger language plpgsql as
  $$ begin new.updated_at = now(); return new; end $$;
create trigger ride_requests_touch before update on ride_requests
  for each row execute function touch_updated_at();

-- Partners may only change status, which partner holds the ride, and driver details.
create function guard_partner_update() returns trigger language plpgsql as $$
begin
  if my_role() = 'partner' and (
    new.org_id, new.rider_id, new.pickup_name, new.pickup_address, new.dropoff_name, new.dropoff_address,
    new.pickup_at, new.appointment_at, new.needs, new.payment_type, new.funding_source_id, new.cost_cap_cents,
    new.driver_notes, new.contact_phone
  ) is distinct from (
    old.org_id, old.rider_id, old.pickup_name, old.pickup_address, old.dropoff_name, old.dropoff_address,
    old.pickup_at, old.appointment_at, old.needs, old.payment_type, old.funding_source_id, old.cost_cap_cents,
    old.driver_notes, old.contact_phone
  ) then
    raise exception 'Partners cannot change trip details';
  end if;
  return new;
end $$;
create trigger ride_requests_guard_partner before update on ride_requests
  for each row execute function guard_partner_update();

-- ── Row Level Security ─────────────────────────────────────────────────────

alter table organizations enable row level security;
alter table profiles enable row level security;
alter table riders enable row level security;
alter table places enable row level security;
alter table funding_sources enable row level security;
alter table ride_requests enable row level security;
alter table ride_events enable row level security;
alter table partner_declines enable row level security;

create policy "signed-in people can see organizations" on organizations
  for select to authenticated using (true);

create policy "see own profile and colleagues" on profiles
  for select to authenticated using (id = auth.uid() or org_id = my_org_id());

create policy "staff manage their org's riders" on riders
  for all to authenticated using (org_id = my_org_id() and is_staff()) with check (org_id = my_org_id() and is_staff());
create policy "partners see riders on rides they hold" on riders
  for select to authenticated using (
    exists (select 1 from ride_requests r where r.rider_id = riders.id and r.partner_org_id = my_org_id()));

create policy "staff manage their org's places" on places
  for all to authenticated using (org_id = my_org_id() and is_staff()) with check (org_id = my_org_id() and is_staff());

create policy "staff see their org's funding" on funding_sources
  for select to authenticated using (org_id = my_org_id() and is_staff());

create policy "staff see their org's rides" on ride_requests
  for select to authenticated using (org_id = my_org_id() and is_staff());
create policy "partners see rides they hold" on ride_requests
  for select to authenticated using (partner_org_id = my_org_id());
create policy "staff create rides" on ride_requests
  for insert to authenticated with check (org_id = my_org_id() and is_staff() and created_by = auth.uid());
create policy "staff update their org's rides" on ride_requests
  for update to authenticated using (org_id = my_org_id() and is_staff()) with check (org_id = my_org_id());
create policy "partners update rides they hold" on ride_requests
  for update to authenticated using (partner_org_id = my_org_id()) with check (partner_org_id = my_org_id());

create policy "see events on visible rides" on ride_events
  for select to authenticated using (exists (select 1 from ride_requests r where r.id = ride_id));
create policy "add events on visible rides" on ride_events
  for insert to authenticated with check (exists (select 1 from ride_requests r where r.id = ride_id));

create policy "partners manage their declines" on partner_declines
  for all to authenticated using (partner_org_id = my_org_id()) with check (partner_org_id = my_org_id());

-- ── Functions for partners (open inbox, accept) ────────────────────────────
-- Open requests are visible to matching partners only through this function,
-- which leaves out the rider's name and the driver notes until they accept.

create function partner_can_serve(o organizations, needs text[], payment_type text) returns boolean
language sql immutable as $$
  select o.type = 'partner'
    and ((payment_type = 'free' and o.offers_free) or (payment_type = 'paid' and o.offers_paid))
    and needs <@ (o.capabilities || array['walker', 'extra_time', 'service_animal'])
$$;

create function open_rides_for_partner()
returns table (
  id uuid, leg text, pickup_name text, pickup_address text, dropoff_name text, dropoff_type text,
  pickup_at timestamptz, appointment_at timestamptz, needs text[], payment_type text,
  cost_cap_cents integer, requesting_org_name text
)
language sql stable security definer set search_path = public as $$
  select r.id, r.leg, r.pickup_name, r.pickup_address, r.dropoff_name, r.dropoff_type,
         r.pickup_at, r.appointment_at, r.needs, r.payment_type, r.cost_cap_cents, req.name
  from ride_requests r
  join organizations req on req.id = r.org_id
  join organizations me on me.id = my_org_id()
  where my_role() = 'partner'
    and r.status = 'requested'
    and partner_can_serve(me, r.needs, r.payment_type)
    and not exists (select 1 from partner_declines d where d.ride_id = r.id and d.partner_org_id = me.id)
  order by r.pickup_at
$$;

create function accept_ride(p_ride uuid, p_actor_name text) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  me organizations;
  claimed uuid;
begin
  if my_role() is distinct from 'partner' then return false; end if;
  select * into me from organizations where id = my_org_id();
  update ride_requests r set status = 'accepted', partner_org_id = me.id
    where r.id = p_ride and r.status = 'requested' and partner_can_serve(me, r.needs, r.payment_type)
    returning r.id into claimed;
  if claimed is null then return false; end if;
  insert into ride_events (ride_id, actor_kind, actor_name, from_status, to_status)
    values (p_ride, 'partner', p_actor_name, 'requested', 'accepted');
  return true;
end $$;

-- Handing a ride back goes through a function: afterwards the partner can no
-- longer see the row, which a plain UPDATE under RLS doesn't allow.
create function release_ride(p_ride uuid, p_actor_name text, p_reason text) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  prev text;
begin
  select status into prev from ride_requests
    where id = p_ride and partner_org_id = my_org_id() and status in ('accepted', 'driver_assigned') for update;
  if prev is null then return false; end if;
  update ride_requests set status = 'requested', partner_org_id = null, driver_name = null, driver_phone = null,
    driver_token = null, driver_token_expires_at = null where id = p_ride;
  insert into ride_events (ride_id, actor_kind, actor_name, from_status, to_status, note)
    values (p_ride, 'partner', p_actor_name, prev, 'requested', coalesce(nullif(p_reason, ''), 'Handed back to the open pool'));
  insert into partner_declines (ride_id, partner_org_id, reason) values (p_ride, my_org_id(), p_reason)
    on conflict (ride_id, partner_org_id) do update set reason = excluded.reason;
  return true;
end $$;

-- ── Functions for drivers (no account; one-ride token link) ─────────────────

create function driver_ride(p_token text) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'id', r.id, 'leg', r.leg, 'pickup_name', r.pickup_name, 'pickup_address', r.pickup_address,
    'dropoff_name', r.dropoff_name, 'dropoff_address', r.dropoff_address, 'pickup_at', r.pickup_at,
    'appointment_at', r.appointment_at, 'needs', r.needs, 'driver_notes', r.driver_notes,
    'contact_phone', r.contact_phone, 'status', r.status, 'driver_name', r.driver_name,
    'rider_display_name', rd.display_name, 'partner_name', p.name)
  from ride_requests r
  join riders rd on rd.id = r.rider_id
  join organizations p on p.id = r.partner_org_id
  where r.driver_token = p_token and r.driver_token_expires_at > now()
$$;

create function driver_set_status(p_token text, p_to text) returns json
language plpgsql security definer set search_path = public as $$
declare
  r ride_requests;
begin
  select * into r from ride_requests where driver_token = p_token and driver_token_expires_at > now() for update;
  if r.id is null then
    return json_build_object('ok', false, 'error', 'This ride link has expired or is no longer active.');
  end if;
  -- Must match canTransition(..., 'driver') in lib/rules.ts.
  if not ((r.status = 'driver_assigned' and p_to in ('picked_up', 'no_show'))
       or (r.status = 'picked_up' and p_to = 'dropped_off')) then
    return json_build_object('ok', false, 'error', 'That update isn''t possible for this ride right now.');
  end if;
  update ride_requests set status = p_to where id = r.id;
  insert into ride_events (ride_id, actor_kind, actor_name, from_status, to_status)
    values (r.id, 'driver', trim('Driver ' || coalesce(r.driver_name, '')), r.status, p_to);
  return json_build_object('ok', true, 'ride', driver_ride(p_token),
    'notify_email', (select contact_email from organizations where id = r.org_id));
end $$;

revoke execute on function open_rides_for_partner, accept_ride, release_ride, driver_ride, driver_set_status from public;
grant execute on function open_rides_for_partner, accept_ride, release_ride to authenticated;
grant execute on function driver_ride, driver_set_status to anon, authenticated;
