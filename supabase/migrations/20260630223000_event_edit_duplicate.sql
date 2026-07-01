create or replace function public.update_event(
  target_event_id uuid,
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
  target_event record;
  target_season_id uuid;
begin
  select * into target_event
  from public.events
  where id = target_event_id;

  if target_event.id is null then
    raise exception 'Event not found';
  end if;

  if not public.is_admin(target_event.team_id) then
    raise exception 'Admin permission is required';
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

grant execute on function public.update_event(uuid, text, public.event_type, date, time, text, timestamptz, integer, text, boolean, boolean, public.event_status) to authenticated;
grant execute on function public.duplicate_event(uuid, date) to authenticated;
