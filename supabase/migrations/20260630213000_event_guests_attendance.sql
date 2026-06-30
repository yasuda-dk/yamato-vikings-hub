create table public.event_guests (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete restrict,
  first_name text not null,
  first_name_normalized text not null,
  age_group public.age_group not null,
  football_level integer not null check (football_level between 1 and 5),
  primary_position public.position_code not null,
  secondary_position public.position_code,
  residence_type public.residence_type not null,
  gender public.gender_type not null default 'Not specified',
  actual_status public.actual_status not null default 'Not confirmed',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint event_guests_first_name_not_blank check (length(first_name_normalized) > 0),
  constraint event_guests_secondary_position_differs check (
    secondary_position is null
    or secondary_position <> primary_position
  ),
  unique (event_id, first_name_normalized)
);

create or replace function public.set_event_guest_first_name_normalized()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.first_name = regexp_replace(btrim(new.first_name), '\s+', ' ', 'g');
  new.first_name_normalized = public.normalize_first_name(new.first_name);
  return new;
end;
$$;

create trigger event_guests_normalize_first_name
before insert or update of first_name on public.event_guests
for each row execute function public.set_event_guest_first_name_normalized();

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

  if not public.is_admin(target_event.team_id) then
    raise exception 'Admin permission is required';
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
    age_group,
    football_level,
    primary_position,
    secondary_position,
    residence_type,
    gender,
    created_by
  )
  values (
    target_event_id,
    p_first_name,
    p_age_group,
    p_football_level,
    p_primary_position,
    p_secondary_position,
    p_residence_type,
    coalesce(p_gender, 'Not specified'),
    auth.uid()
  )
  returning id into new_guest_id;

  return new_guest_id;
end;
$$;

create or replace function public.set_member_actual_status(
  target_event_id uuid,
  target_member_id uuid,
  p_actual_status public.actual_status
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_event record;
  attendance_id uuid;
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

  insert into public.attendance (
    event_id,
    member_id,
    rsvp_status,
    is_arriving_late,
    expected_arrival_time,
    responded_at,
    actual_status,
    actual_status_confirmed_at,
    actual_status_confirmed_by
  )
  values (
    target_event_id,
    target_member_id,
    'Maybe',
    false,
    null,
    now(),
    p_actual_status,
    now(),
    auth.uid()
  )
  on conflict (event_id, member_id)
  do update set
    actual_status = excluded.actual_status,
    actual_status_confirmed_at = excluded.actual_status_confirmed_at,
    actual_status_confirmed_by = excluded.actual_status_confirmed_by
  returning id into attendance_id;

  return attendance_id;
end;
$$;

create or replace function public.set_guest_actual_status(
  target_event_guest_id uuid,
  p_actual_status public.actual_status
)
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

  if not public.is_admin(target_guest.team_id) then
    raise exception 'Admin permission is required';
  end if;

  update public.event_guests
  set actual_status = p_actual_status
  where id = target_event_guest_id;

  return target_event_guest_id;
end;
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
      'going', coalesce((select count(*) from public.attendance a where a.event_id = e.id and a.rsvp_status = 'Going'), 0),
      'maybe', coalesce((select count(*) from public.attendance a where a.event_id = e.id and a.rsvp_status = 'Maybe'), 0),
      'notGoing', coalesce((select count(*) from public.attendance a where a.event_id = e.id and a.rsvp_status = 'Not going'), 0),
      'late', coalesce((select count(*) from public.attendance a where a.event_id = e.id and a.rsvp_status = 'Going' and a.is_arriving_late), 0),
      'attended', coalesce((select count(*) from public.attendance a where a.event_id = e.id and a.actual_status = 'Attended'), 0)
        + coalesce((select count(*) from public.event_guests guest where guest.event_id = e.id and guest.actual_status = 'Attended'), 0),
      'guests', coalesce((select count(*) from public.event_guests guest where guest.event_id = e.id), 0)
    ),
    'participants', coalesce((
      select jsonb_agg(participant order by participant->>'sortName')
      from (
        select jsonb_build_object(
          'kind', 'member',
          'id', m.id,
          'first_name', m.first_name,
          'rsvp_status', a.rsvp_status,
          'is_arriving_late', a.is_arriving_late,
          'expected_arrival_time', a.expected_arrival_time,
          'actual_status', a.actual_status,
          'football_level', m.football_level,
          'primary_position', m.primary_position,
          'secondary_position', m.secondary_position,
          'sortName', m.first_name_normalized
        ) as participant
        from public.attendance a
        join public.members m on m.id = a.member_id
        where a.event_id = e.id
        union all
        select jsonb_build_object(
          'kind', 'guest',
          'id', guest.id,
          'first_name', guest.first_name,
          'rsvp_status', null,
          'is_arriving_late', false,
          'expected_arrival_time', null,
          'actual_status', guest.actual_status,
          'football_level', guest.football_level,
          'primary_position', guest.primary_position,
          'secondary_position', guest.secondary_position,
          'sortName', guest.first_name_normalized
        ) as participant
        from public.event_guests guest
        where guest.event_id = e.id
      ) participants
    ), '[]'::jsonb),
    'guests', coalesce((
      select jsonb_agg(to_jsonb(guest) order by guest.first_name_normalized)
      from public.event_guests guest
      where guest.event_id = e.id
    ), '[]'::jsonb)
  )
  from public.events e
  where e.id = target_event_id
    and public.has_current_device_access(e.team_id);
$$;

alter table public.event_guests enable row level security;

create policy "Approved devices can read event guests"
on public.event_guests for select
using (
  exists (
    select 1
    from public.events e
    where e.id = event_guests.event_id
      and public.has_current_device_access(e.team_id)
  )
);

grant execute on function public.create_event_guest(uuid, text, public.age_group, integer, public.position_code, public.position_code, public.residence_type, public.gender_type) to authenticated;
grant execute on function public.set_member_actual_status(uuid, uuid, public.actual_status) to authenticated;
grant execute on function public.set_guest_actual_status(uuid, public.actual_status) to authenticated;
