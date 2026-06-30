create type public.event_type as enum ('Football', 'Tournament', 'Social', 'Other');
create type public.event_status as enum ('Draft', 'Open', 'Attendance confirmed', 'Teams confirmed', 'Voting open', 'Completed', 'Cancelled');
create type public.rsvp_status as enum ('Going', 'Maybe', 'Not going');
create type public.actual_status as enum ('Not confirmed', 'Attended', 'Absent');

create table public.seasons (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete restrict,
  name text not null,
  start_date date not null,
  end_date date not null,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  constraint seasons_valid_dates check (start_date <= end_date),
  unique (team_id, name)
);

create unique index seasons_one_active_per_team
  on public.seasons(team_id)
  where is_active;

create table public.events (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete restrict,
  season_id uuid not null references public.seasons(id) on delete restrict,
  title text not null,
  event_type public.event_type not null,
  event_date date not null,
  start_time time not null,
  location text not null,
  rsvp_deadline timestamptz not null,
  number_of_teams integer not null default 2 check (number_of_teams between 2 and 4),
  notes text,
  enable_team_generation boolean not null default true,
  enable_voting boolean not null default true,
  status public.event_status not null default 'Open',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint events_title_not_blank check (length(btrim(title)) > 0),
  constraint events_location_not_blank check (length(btrim(location)) > 0)
);

create table public.attendance (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete restrict,
  member_id uuid not null references public.members(id) on delete restrict,
  rsvp_status public.rsvp_status not null,
  is_arriving_late boolean not null default false,
  expected_arrival_time time,
  responded_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  was_updated_after_deadline boolean not null default false,
  actual_status public.actual_status not null default 'Not confirmed',
  actual_status_confirmed_at timestamptz,
  actual_status_confirmed_by uuid references auth.users(id) on delete set null,
  unique (event_id, member_id),
  constraint attendance_late_only_when_going check (
    rsvp_status = 'Going'
    or (is_arriving_late = false and expected_arrival_time is null)
  ),
  constraint attendance_expected_time_requires_late check (
    is_arriving_late = true
    or expected_arrival_time is null
  )
);

create trigger events_touch_updated_at
before update on public.events
for each row execute function public.touch_updated_at();

create trigger attendance_touch_updated_at
before update on public.attendance
for each row execute function public.touch_updated_at();

insert into public.seasons (team_id, name, start_date, end_date, is_active)
values (
  '00000000-0000-0000-0000-000000000001',
  'Season 2026',
  '2026-01-01',
  '2026-12-31',
  true
)
on conflict (team_id, name) do nothing;

create or replace function public.create_event(
  target_team_id uuid,
  p_title text,
  p_event_type public.event_type,
  p_event_date date,
  p_start_time time,
  p_location text,
  p_rsvp_deadline timestamptz,
  p_number_of_teams integer,
  p_notes text,
  p_enable_team_generation boolean,
  p_enable_voting boolean,
  p_status public.event_status
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_season_id uuid;
  new_event_id uuid;
begin
  if not public.is_admin(target_team_id) then
    raise exception 'Admin permission is required';
  end if;

  select id into target_season_id
  from public.seasons
  where team_id = target_team_id
    and p_event_date between start_date and end_date
  order by is_active desc, start_date desc
  limit 1;

  if target_season_id is null then
    raise exception 'No season exists for this event date';
  end if;

  insert into public.events (
    team_id,
    season_id,
    title,
    event_type,
    event_date,
    start_time,
    location,
    rsvp_deadline,
    number_of_teams,
    notes,
    enable_team_generation,
    enable_voting,
    status,
    created_by
  )
  values (
    target_team_id,
    target_season_id,
    regexp_replace(btrim(p_title), '\s+', ' ', 'g'),
    p_event_type,
    p_event_date,
    p_start_time,
    regexp_replace(btrim(p_location), '\s+', ' ', 'g'),
    p_rsvp_deadline,
    p_number_of_teams,
    nullif(btrim(p_notes), ''),
    p_enable_team_generation,
    p_enable_voting,
    p_status,
    auth.uid()
  )
  returning id into new_event_id;

  return new_event_id;
end;
$$;

create or replace function public.upsert_my_rsvp(
  target_event_id uuid,
  p_rsvp_status public.rsvp_status,
  p_is_arriving_late boolean,
  p_expected_arrival_time time
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  active_member_id uuid := public.current_member_id();
  target_event record;
  normalized_is_late boolean := false;
  normalized_arrival_time time := null;
  updated_after_deadline boolean;
  attendance_id uuid;
begin
  if active_member_id is null then
    raise exception 'No active member profile selected';
  end if;

  select * into target_event
  from public.events
  where id = target_event_id;

  if target_event.id is null then
    raise exception 'Event not found';
  end if;

  if not public.has_current_device_access(target_event.team_id) then
    raise exception 'Current device is not approved';
  end if;

  if target_event.status = 'Cancelled' then
    raise exception 'Cancelled events do not accept RSVP changes';
  end if;

  if p_rsvp_status = 'Going' then
    normalized_is_late := coalesce(p_is_arriving_late, false);
    if normalized_is_late then
      normalized_arrival_time := p_expected_arrival_time;
    end if;
  end if;

  updated_after_deadline := now() > target_event.rsvp_deadline;

  insert into public.attendance (
    event_id,
    member_id,
    rsvp_status,
    is_arriving_late,
    expected_arrival_time,
    responded_at,
    was_updated_after_deadline
  )
  values (
    target_event_id,
    active_member_id,
    p_rsvp_status,
    normalized_is_late,
    normalized_arrival_time,
    now(),
    updated_after_deadline
  )
  on conflict (event_id, member_id)
  do update set
    rsvp_status = excluded.rsvp_status,
    is_arriving_late = excluded.is_arriving_late,
    expected_arrival_time = excluded.expected_arrival_time,
    was_updated_after_deadline = attendance.was_updated_after_deadline or excluded.was_updated_after_deadline
  returning id into attendance_id;

  return attendance_id;
end;
$$;

create or replace function public.list_events(target_team_id uuid)
returns table (
  id uuid,
  title text,
  event_type public.event_type,
  event_date date,
  start_time time,
  location text,
  rsvp_deadline timestamptz,
  status public.event_status,
  my_rsvp_status public.rsvp_status,
  going_count bigint,
  maybe_count bigint,
  not_going_count bigint,
  late_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    e.id,
    e.title,
    e.event_type,
    e.event_date,
    e.start_time,
    e.location,
    e.rsvp_deadline,
    e.status,
    my_attendance.rsvp_status as my_rsvp_status,
    count(a.id) filter (where a.rsvp_status = 'Going') as going_count,
    count(a.id) filter (where a.rsvp_status = 'Maybe') as maybe_count,
    count(a.id) filter (where a.rsvp_status = 'Not going') as not_going_count,
    count(a.id) filter (where a.rsvp_status = 'Going' and a.is_arriving_late) as late_count
  from public.events e
  left join public.attendance a on a.event_id = e.id
  left join public.attendance my_attendance
    on my_attendance.event_id = e.id
    and my_attendance.member_id = public.current_member_id()
  where e.team_id = target_team_id
    and public.has_current_device_access(target_team_id)
  group by e.id, my_attendance.rsvp_status
  order by e.event_date asc, e.start_time asc;
$$;

create or replace function public.get_event_detail(target_event_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'event', to_jsonb(e),
    'myRsvp', (
      select to_jsonb(a)
      from public.attendance a
      where a.event_id = e.id
        and a.member_id = public.current_member_id()
      limit 1
    ),
    'counts', jsonb_build_object(
      'going', count(a.id) filter (where a.rsvp_status = 'Going'),
      'maybe', count(a.id) filter (where a.rsvp_status = 'Maybe'),
      'notGoing', count(a.id) filter (where a.rsvp_status = 'Not going'),
      'late', count(a.id) filter (where a.rsvp_status = 'Going' and a.is_arriving_late)
    )
  )
  from public.events e
  left join public.attendance a on a.event_id = e.id
  where e.id = target_event_id
    and public.has_current_device_access(e.team_id)
  group by e.id;
$$;

alter table public.seasons enable row level security;
alter table public.events enable row level security;
alter table public.attendance enable row level security;

create policy "Approved devices can read seasons"
on public.seasons for select
using (public.has_current_device_access(team_id));

create policy "Approved devices can read events"
on public.events for select
using (public.has_current_device_access(team_id));

create policy "Approved devices can read attendance"
on public.attendance for select
using (
  exists (
    select 1
    from public.events e
    where e.id = attendance.event_id
      and public.has_current_device_access(e.team_id)
  )
);

grant execute on function public.create_event(uuid, text, public.event_type, date, time, text, timestamptz, integer, text, boolean, boolean, public.event_status) to authenticated;
grant execute on function public.upsert_my_rsvp(uuid, public.rsvp_status, boolean, time) to authenticated;
grant execute on function public.list_events(uuid) to authenticated;
grant execute on function public.get_event_detail(uuid) to authenticated;
