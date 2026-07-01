create table public.event_teams (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete restrict,
  name text not null,
  display_order integer not null,
  is_confirmed boolean not null default false,
  balance_score numeric,
  score_breakdown jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_teams_name_not_blank check (length(btrim(name)) > 0),
  unique (event_id, display_order)
);

create table public.event_team_participants (
  id uuid primary key default gen_random_uuid(),
  event_team_id uuid not null references public.event_teams(id) on delete cascade,
  member_id uuid references public.members(id) on delete restrict,
  event_guest_id uuid references public.event_guests(id) on delete restrict,
  is_locked boolean not null default false,
  created_at timestamptz not null default now(),
  constraint event_team_participants_one_subject check (
    (member_id is not null and event_guest_id is null)
    or (member_id is null and event_guest_id is not null)
  )
);

create trigger event_teams_touch_updated_at
before update on public.event_teams
for each row execute function public.touch_updated_at();

create or replace function public.get_team_generation_participants(target_event_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(participant order by participant->>'first_name'), '[]'::jsonb)
  from (
    select jsonb_build_object(
      'kind', 'member',
      'id', m.id,
      'first_name', m.first_name,
      'football_level', m.football_level,
      'primary_position', m.primary_position,
      'secondary_position', m.secondary_position,
      'age_group', m.age_group,
      'actual_status', a.actual_status,
      'membership_status', m.membership_status
    ) as participant
    from public.events e
    join public.attendance a on a.event_id = e.id
    join public.members m on m.id = a.member_id
    where e.id = target_event_id
      and public.is_admin(e.team_id)
      and a.actual_status = 'Attended'
      and m.membership_status = 'Active'
    union all
    select jsonb_build_object(
      'kind', 'guest',
      'id', guest.id,
      'first_name', guest.first_name,
      'football_level', guest.football_level,
      'primary_position', guest.primary_position,
      'secondary_position', guest.secondary_position,
      'age_group', guest.age_group,
      'actual_status', guest.actual_status,
      'membership_status', 'Active'
    ) as participant
    from public.events e
    join public.event_guests guest on guest.event_id = e.id
    where e.id = target_event_id
      and public.is_admin(e.team_id)
      and guest.actual_status = 'Attended'
  ) participants;
$$;

create or replace function public.save_draft_teams(
  target_event_id uuid,
  p_teams jsonb,
  p_balance_score numeric,
  p_score_breakdown jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_event record;
  team_item jsonb;
  participant_item jsonb;
  new_team_id uuid;
  display_index integer := 0;
  assigned_count integer;
  eligible_count integer;
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

  delete from public.event_teams
  where event_id = target_event_id
    and is_confirmed = false;

  for team_item in select * from jsonb_array_elements(p_teams)
  loop
    insert into public.event_teams (
      event_id,
      name,
      display_order,
      is_confirmed,
      balance_score,
      score_breakdown
    )
    values (
      target_event_id,
      coalesce(team_item->>'name', 'Team'),
      display_index,
      false,
      p_balance_score,
      p_score_breakdown
    )
    returning id into new_team_id;

    for participant_item in select * from jsonb_array_elements(coalesce(team_item->'participants', '[]'::jsonb))
    loop
      if participant_item->>'kind' = 'member' and not exists (
        select 1
        from public.attendance a
        join public.members m on m.id = a.member_id
        where a.event_id = target_event_id
          and a.member_id = (participant_item->>'id')::uuid
          and a.actual_status = 'Attended'
          and m.membership_status = 'Active'
      ) then
        raise exception 'Only attended active members can be added to draft teams';
      end if;

      if participant_item->>'kind' = 'guest' and not exists (
        select 1
        from public.event_guests guest
        where guest.event_id = target_event_id
          and guest.id = (participant_item->>'id')::uuid
          and guest.actual_status = 'Attended'
      ) then
        raise exception 'Only attended event guests can be added to draft teams';
      end if;

      insert into public.event_team_participants (
        event_team_id,
        member_id,
        event_guest_id,
        is_locked
      )
      values (
        new_team_id,
        case when participant_item->>'kind' = 'member' then (participant_item->>'id')::uuid else null end,
        case when participant_item->>'kind' = 'guest' then (participant_item->>'id')::uuid else null end,
        false
      );
    end loop;

    display_index := display_index + 1;
  end loop;

  select count(*) into assigned_count
  from public.event_team_participants etp
  join public.event_teams team on team.id = etp.event_team_id
  where team.event_id = target_event_id
    and team.is_confirmed = false;

  select (
    select count(*)
    from public.attendance a
    join public.members m on m.id = a.member_id
    where a.event_id = target_event_id
      and a.actual_status = 'Attended'
      and m.membership_status = 'Active'
  ) + (
    select count(*)
    from public.event_guests guest
    where guest.event_id = target_event_id
      and guest.actual_status = 'Attended'
  ) into eligible_count;

  if assigned_count <> eligible_count then
    raise exception 'Every eligible participant must be assigned exactly once';
  end if;

  if exists (
    select 1
    from public.event_team_participants etp
    join public.event_teams team on team.id = etp.event_team_id
    where team.event_id = target_event_id
      and team.is_confirmed = false
    group by etp.member_id
    having etp.member_id is not null and count(*) > 1
  ) or exists (
    select 1
    from public.event_team_participants etp
    join public.event_teams team on team.id = etp.event_team_id
    where team.event_id = target_event_id
      and team.is_confirmed = false
    group by etp.event_guest_id
    having etp.event_guest_id is not null and count(*) > 1
  ) then
    raise exception 'Every eligible participant must be assigned exactly once';
  end if;

  return public.get_event_teams(target_event_id);
end;
$$;

create or replace function public.get_event_teams(target_event_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(team_json order by (team_json->>'display_order')::integer), '[]'::jsonb)
  from (
    select jsonb_build_object(
      'id', team.id,
      'event_id', team.event_id,
      'name', team.name,
      'display_order', team.display_order,
      'is_confirmed', team.is_confirmed,
      'balance_score', team.balance_score,
      'score_breakdown', team.score_breakdown,
      'participants', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'kind', case when etp.member_id is not null then 'member' else 'guest' end,
            'id', coalesce(etp.member_id, etp.event_guest_id),
            'first_name', coalesce(m.first_name, guest.first_name),
            'football_level', coalesce(m.football_level, guest.football_level),
            'primary_position', coalesce(m.primary_position, guest.primary_position),
            'secondary_position', coalesce(m.secondary_position, guest.secondary_position),
            'age_group', coalesce(m.age_group, guest.age_group),
            'is_locked', etp.is_locked
          )
          order by coalesce(m.first_name_normalized, guest.first_name_normalized)
        )
        from public.event_team_participants etp
        left join public.members m on m.id = etp.member_id
        left join public.event_guests guest on guest.id = etp.event_guest_id
        where etp.event_team_id = team.id
      ), '[]'::jsonb)
    ) as team_json
    from public.event_teams team
    join public.events e on e.id = team.event_id
    where team.event_id = target_event_id
      and (
        team.is_confirmed = true
        or public.is_admin(e.team_id)
      )
  ) teams;
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
          'age_group', m.age_group,
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
          'age_group', guest.age_group,
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

alter table public.event_teams enable row level security;
alter table public.event_team_participants enable row level security;

create policy "Approved devices can read confirmed teams and admins can read drafts"
on public.event_teams for select
using (
  exists (
    select 1
    from public.events e
    where e.id = event_teams.event_id
      and public.has_current_device_access(e.team_id)
      and (event_teams.is_confirmed = true or public.is_admin(e.team_id))
  )
);

create policy "Approved devices can read confirmed team participants and admins can read drafts"
on public.event_team_participants for select
using (
  exists (
    select 1
    from public.event_teams team
    join public.events e on e.id = team.event_id
    where team.id = event_team_participants.event_team_id
      and public.has_current_device_access(e.team_id)
      and (team.is_confirmed = true or public.is_admin(e.team_id))
  )
);

grant execute on function public.get_team_generation_participants(uuid) to authenticated;
grant execute on function public.save_draft_teams(uuid, jsonb, numeric, jsonb) to authenticated;
grant execute on function public.get_event_teams(uuid) to authenticated;
