alter table public.events
  add column if not exists pitch_type text not null default '7 aside half indoor';

alter table public.events
  drop constraint if exists events_pitch_type_check;

alter table public.events
  add constraint events_pitch_type_check
  check (pitch_type in ('7 aside half indoor', '4 vs 4'));

create or replace function public.create_event(
  target_team_id uuid,
  p_title text,
  p_event_type public.event_type,
  p_event_date date,
  p_start_time time,
  p_location text,
  p_pitch_type text,
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
  normalized_pitch_type text := coalesce(nullif(btrim(p_pitch_type), ''), '7 aside half indoor');
begin
  if not public.can_manage_events(target_team_id) then
    raise exception 'Event manager permission is required';
  end if;

  if normalized_pitch_type not in ('7 aside half indoor', '4 vs 4') then
    raise exception 'Select a valid pitch';
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
    pitch_type,
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
    normalized_pitch_type,
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

create or replace function public.update_event(
  target_event_id uuid,
  p_title text,
  p_event_type public.event_type,
  p_event_date date,
  p_start_time time,
  p_location text,
  p_pitch_type text,
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
  target_event record;
  target_season_id uuid;
  normalized_pitch_type text := coalesce(nullif(btrim(p_pitch_type), ''), '7 aside half indoor');
begin
  select * into target_event
  from public.events
  where id = target_event_id;

  if target_event.id is null then
    raise exception 'Event not found';
  end if;

  if not public.can_manage_events(target_event.team_id) then
    raise exception 'Event manager permission is required';
  end if;

  if normalized_pitch_type not in ('7 aside half indoor', '4 vs 4') then
    raise exception 'Select a valid pitch';
  end if;

  select id into target_season_id
  from public.seasons
  where team_id = target_event.team_id
    and p_event_date between start_date and end_date
  order by is_active desc, start_date desc
  limit 1;

  if target_season_id is null then
    raise exception 'No season exists for this event date';
  end if;

  update public.events
  set
    season_id = target_season_id,
    title = regexp_replace(btrim(p_title), '\s+', ' ', 'g'),
    event_type = p_event_type,
    event_date = p_event_date,
    start_time = p_start_time,
    location = regexp_replace(btrim(p_location), '\s+', ' ', 'g'),
    pitch_type = normalized_pitch_type,
    rsvp_deadline = p_rsvp_deadline,
    number_of_teams = p_number_of_teams,
    notes = nullif(btrim(p_notes), ''),
    enable_team_generation = p_enable_team_generation,
    enable_voting = p_enable_voting,
    status = p_status
  where id = target_event_id;

  return target_event_id;
end;
$$;

create or replace function public.duplicate_event(
  target_event_id uuid,
  p_event_date date
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  source_event record;
  target_season_id uuid;
  new_event_id uuid;
begin
  select * into source_event
  from public.events
  where id = target_event_id;

  if source_event.id is null then
    raise exception 'Event not found';
  end if;

  if not public.is_admin(source_event.team_id) then
    raise exception 'Admin permission is required';
  end if;

  if p_event_date = source_event.event_date then
    raise exception 'Choose a new date for the duplicated event';
  end if;

  select id into target_season_id
  from public.seasons
  where team_id = source_event.team_id
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
    pitch_type,
    rsvp_deadline,
    number_of_teams,
    notes,
    enable_team_generation,
    enable_voting,
    status,
    created_by
  )
  values (
    source_event.team_id,
    target_season_id,
    source_event.title,
    source_event.event_type,
    p_event_date,
    source_event.start_time,
    source_event.location,
    source_event.pitch_type,
    p_event_date::timestamptz + (source_event.rsvp_deadline::time),
    source_event.number_of_teams,
    source_event.notes,
    source_event.enable_team_generation,
    source_event.enable_voting,
    'Open',
    auth.uid()
  )
  returning id into new_event_id;

  return new_event_id;
end;
$$;

-- PostgreSQL requires recreating a function when its table return type changes.
drop function public.list_events(uuid);

create function public.list_events(target_team_id uuid)
returns table (
  id uuid,
  title text,
  event_type public.event_type,
  event_date date,
  start_time time,
  location text,
  pitch_type text,
  rsvp_deadline timestamptz,
  status public.event_status,
  my_rsvp_status public.rsvp_status,
  going_count bigint,
  guest_count bigint,
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
    e.pitch_type,
    e.rsvp_deadline,
    e.status,
    my_attendance.rsvp_status as my_rsvp_status,
    count(distinct a.id) filter (where a.rsvp_status = 'Going') as going_count,
    count(distinct guest.id) as guest_count,
    count(distinct a.id) filter (where a.rsvp_status = 'Maybe') as maybe_count,
    count(distinct a.id) filter (where a.rsvp_status = 'Not going') as not_going_count,
    count(distinct a.id) filter (where a.rsvp_status = 'Going' and a.is_arriving_late) as late_count
  from public.events e
  left join public.attendance a on a.event_id = e.id
  left join public.event_guests guest on guest.event_id = e.id
  left join public.attendance my_attendance
    on my_attendance.event_id = e.id
    and my_attendance.member_id = public.current_member_id()
  where e.team_id = target_team_id
    and e.event_date >= (now() at time zone 'Europe/Copenhagen')::date
    and (e.status <> 'Cancelled' or public.can_manage_events(target_team_id))
    and public.has_current_device_access(target_team_id)
  group by e.id, my_attendance.rsvp_status
  order by e.event_date asc, e.start_time asc;
$$;

revoke execute on function public.create_event(uuid, text, public.event_type, date, time, text, text, timestamptz, integer, text, boolean, boolean, public.event_status) from public, anon;
revoke execute on function public.update_event(uuid, text, public.event_type, date, time, text, text, timestamptz, integer, text, boolean, boolean, public.event_status) from public, anon;
revoke execute on function public.list_events(uuid) from public, anon;

grant execute on function public.create_event(uuid, text, public.event_type, date, time, text, text, timestamptz, integer, text, boolean, boolean, public.event_status) to authenticated;
grant execute on function public.update_event(uuid, text, public.event_type, date, time, text, text, timestamptz, integer, text, boolean, boolean, public.event_status) to authenticated;
grant execute on function public.duplicate_event(uuid, date) to authenticated;
grant execute on function public.list_events(uuid) to authenticated;
