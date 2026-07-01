drop function if exists public.adjust_draft_team(uuid, text, uuid, text, uuid, uuid, text, boolean);

create or replace function public.adjust_draft_team(
  target_event_id uuid,
  p_action text,
  p_team_id uuid default null,
  p_participant_kind text default null,
  p_participant_id uuid default null,
  p_target_team_id uuid default null,
  p_name text default null,
  p_is_locked boolean default null,
  p_swap_participant_kind text default null,
  p_swap_participant_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_event record;
  target_row_id uuid;
  swap_row_id uuid;
  target_current_team_id uuid;
  swap_current_team_id uuid;
  existing_confirmed_count integer;
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

  if p_action = 'rename-team' then
    if p_team_id is null or length(btrim(coalesce(p_name, ''))) = 0 then
      raise exception 'Team name is required';
    end if;

    update public.event_teams
    set name = btrim(p_name)
    where id = p_team_id
      and event_id = target_event_id
      and is_confirmed = false;

    if not found then
      raise exception 'Draft team not found';
    end if;

    return public.get_event_teams(target_event_id);
  end if;

  if p_action = 'toggle-lock' then
    if p_participant_kind not in ('member', 'guest') or p_participant_id is null or p_is_locked is null then
      raise exception 'Participant and lock state are required';
    end if;

    update public.event_team_participants etp
    set is_locked = p_is_locked
    from public.event_teams team
    where team.id = etp.event_team_id
      and team.event_id = target_event_id
      and team.is_confirmed = false
      and (
        (p_participant_kind = 'member' and etp.member_id = p_participant_id)
        or (p_participant_kind = 'guest' and etp.event_guest_id = p_participant_id)
      );

    if not found then
      raise exception 'Draft participant not found';
    end if;

    return public.get_event_teams(target_event_id);
  end if;

  if p_action = 'move-participant' then
    if p_target_team_id is null or p_participant_kind not in ('member', 'guest') or p_participant_id is null then
      raise exception 'Participant and target team are required';
    end if;

    if not exists (
      select 1
      from public.event_teams team
      where team.id = p_target_team_id
        and team.event_id = target_event_id
        and team.is_confirmed = false
    ) then
      raise exception 'Target draft team not found';
    end if;

    select etp.id into target_row_id
    from public.event_team_participants etp
    join public.event_teams team on team.id = etp.event_team_id
    where team.event_id = target_event_id
      and team.is_confirmed = false
      and (
        (p_participant_kind = 'member' and etp.member_id = p_participant_id)
        or (p_participant_kind = 'guest' and etp.event_guest_id = p_participant_id)
      )
    limit 1;

    if target_row_id is null then
      raise exception 'Draft participant not found';
    end if;

    if exists (
      select 1
      from public.event_team_participants
      where id = target_row_id
        and is_locked = true
    ) then
      raise exception 'Unlock this participant before moving';
    end if;

    update public.event_team_participants
    set event_team_id = p_target_team_id
    where id = target_row_id;

    update public.event_teams
    set balance_score = null,
      score_breakdown = null
    where event_id = target_event_id
      and is_confirmed = false;

    return public.get_event_teams(target_event_id);
  end if;

  if p_action = 'swap-participants' then
    if p_participant_kind not in ('member', 'guest') or p_swap_participant_kind not in ('member', 'guest') or p_participant_id is null or p_swap_participant_id is null then
      raise exception 'Two participants are required';
    end if;

    if p_participant_kind = p_swap_participant_kind and p_participant_id = p_swap_participant_id then
      raise exception 'Choose two different participants';
    end if;

    select etp.id, etp.event_team_id into target_row_id, target_current_team_id
    from public.event_team_participants etp
    join public.event_teams team on team.id = etp.event_team_id
    where team.event_id = target_event_id
      and team.is_confirmed = false
      and (
        (p_participant_kind = 'member' and etp.member_id = p_participant_id)
        or (p_participant_kind = 'guest' and etp.event_guest_id = p_participant_id)
      )
    limit 1;

    select etp.id, etp.event_team_id into swap_row_id, swap_current_team_id
    from public.event_team_participants etp
    join public.event_teams team on team.id = etp.event_team_id
    where team.event_id = target_event_id
      and team.is_confirmed = false
      and (
        (p_swap_participant_kind = 'member' and etp.member_id = p_swap_participant_id)
        or (p_swap_participant_kind = 'guest' and etp.event_guest_id = p_swap_participant_id)
      )
    limit 1;

    if target_row_id is null or swap_row_id is null then
      raise exception 'Draft participant not found';
    end if;

    if exists (
      select 1
      from public.event_team_participants
      where id in (target_row_id, swap_row_id)
        and is_locked = true
    ) then
      raise exception 'Unlock participants before swapping';
    end if;

    update public.event_team_participants
    set event_team_id = case
      when id = target_row_id then swap_current_team_id
      when id = swap_row_id then target_current_team_id
      else event_team_id
    end
    where id in (target_row_id, swap_row_id);

    update public.event_teams
    set balance_score = null,
      score_breakdown = null
    where event_id = target_event_id
      and is_confirmed = false;

    return public.get_event_teams(target_event_id);
  end if;

  if p_action = 'confirm-teams' then
    select count(*) into existing_confirmed_count
    from public.event_teams
    where event_id = target_event_id
      and is_confirmed = true;

    if existing_confirmed_count > 0 then
      raise exception 'Teams are already confirmed for this event';
    end if;

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

    if assigned_count = 0 or assigned_count <> eligible_count then
      raise exception 'Draft teams must include every eligible participant before confirmation';
    end if;

    update public.event_teams
    set is_confirmed = true
    where event_id = target_event_id
      and is_confirmed = false;

    update public.events
    set status = 'Teams confirmed'
    where id = target_event_id;

    return public.get_event_teams(target_event_id);
  end if;

  raise exception 'Unsupported team adjustment';
end;
$$;

grant execute on function public.adjust_draft_team(uuid, text, uuid, text, uuid, uuid, text, boolean, text, uuid) to authenticated;
