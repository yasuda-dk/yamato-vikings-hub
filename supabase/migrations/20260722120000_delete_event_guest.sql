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

  if not public.is_admin(target_guest.team_id) then
    raise exception 'Admin permission is required';
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

grant execute on function public.delete_event_guest(uuid) to authenticated;
