create or replace function public.can_manage_events(target_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin(target_team_id)
    or exists (
      select 1
      from public.member_device_links mdl
      join public.members m on m.id = mdl.member_id
      where mdl.auth_user_id = auth.uid()
        and mdl.unlinked_at is null
        and m.team_id = target_team_id
        and m.membership_status = 'Active'
        and m.first_name_normalized = 'yua'
        and public.has_current_device_access(target_team_id)
    );
$$;

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
  if not public.can_manage_events(target_team_id) then
    raise exception 'Event manager permission is required';
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

  if not public.can_manage_events(target_event.team_id) then
    raise exception 'Event manager permission is required';
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

create or replace function public.create_event_guest(
  target_event_id uuid,
  p_first_name text,
  p_age_group public.age_group,
  p_football_level integer,
  p_primary_position public.position_code,
  p_secondary_position public.position_code,
  p_residence_type public.residence_type,
  p_gender public.gender_type
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_event record;
  normalized_name text := public.normalize_first_name(p_first_name);
  new_guest_id uuid;
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

  if normalized_name = '' then
    raise exception 'First name is required';
  end if;

  if exists (
    select 1
    from public.event_guests guest
    where guest.event_id = target_event_id
      and guest.first_name_normalized = normalized_name
  ) then
    raise exception 'This name is already used by a participant in this event.';
  end if;

  if exists (
    select 1
    from public.attendance a
    join public.members m on m.id = a.member_id
    where a.event_id = target_event_id
      and m.first_name_normalized = normalized_name
  ) then
    raise exception 'This name is already used by a participant in this event.';
  end if;

  insert into public.event_guests (
    event_id,
    first_name,
    first_name_normalized,
    age_group,
    football_level,
    primary_position,
    secondary_position,
    residence_type,
    gender,
    actual_status,
    created_by
  )
  values (
    target_event_id,
    regexp_replace(btrim(p_first_name), '\s+', ' ', 'g'),
    normalized_name,
    p_age_group,
    p_football_level,
    p_primary_position,
    p_secondary_position,
    p_residence_type,
    p_gender,
    'Not confirmed',
    auth.uid()
  )
  returning id into new_guest_id;

  return new_guest_id;
end;
$$;

create or replace function public.delete_event_guest(target_event_guest_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_guest record;
begin
  select guest.*, e.team_id into target_guest
  from public.event_guests guest
  join public.events e on e.id = guest.event_id
  where guest.id = target_event_guest_id;

  if target_guest.id is null then
    raise exception 'Guest not found';
  end if;

  if not public.can_manage_events(target_guest.team_id) then
    raise exception 'Event manager permission is required';
  end if;

  if target_guest.actual_status <> 'Not confirmed' then
    raise exception 'Guest already has historical activity and cannot be removed.';
  end if;

  if exists (
    select 1
    from public.event_team_participants participant
    where participant.event_guest_id = target_event_guest_id
  )
    or exists (
      select 1
      from public.votes vote
      where vote.candidate_event_guest_id = target_event_guest_id
    )
    or exists (
      select 1
      from public.event_awards award
      where award.event_guest_id = target_event_guest_id
    )
    or exists (
      select 1
      from public.fines fine
      where fine.event_guest_id = target_event_guest_id
    ) then
    raise exception 'Guest is used in teams, voting, awards or fines and cannot be removed.';
  end if;

  delete from public.event_guests
  where id = target_event_guest_id;

  insert into public.audit_log (
    team_id,
    actor_auth_user_id,
    entity_type,
    entity_id,
    action,
    old_value,
    new_value
  )
  values (
    target_guest.team_id,
    auth.uid(),
    'event_guest',
    target_event_guest_id,
    'delete_event_guest',
    to_jsonb(target_guest) - 'team_id',
    null
  );

  return target_event_guest_id;
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
    and e.event_date >= (now() at time zone 'Europe/Copenhagen')::date
    and (e.status <> 'Cancelled' or public.can_manage_events(target_team_id))
    and public.has_current_device_access(target_team_id)
  group by e.id, my_attendance.rsvp_status
  order by e.event_date asc, e.start_time asc;
$$;

grant execute on function public.can_manage_events(uuid) to anon, authenticated;
