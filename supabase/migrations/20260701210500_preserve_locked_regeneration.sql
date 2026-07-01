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
        coalesce((participant_item->>'is_locked')::boolean, false)
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
