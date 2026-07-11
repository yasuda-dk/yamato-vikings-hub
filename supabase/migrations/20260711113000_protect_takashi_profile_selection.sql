create or replace function public.select_member_profile(target_member_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  member_team_id uuid;
  target_member public.members%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required';
  end if;

  select * into target_member
  from public.members
  where id = target_member_id;

  if target_member.id is null then
    raise exception 'Member not found';
  end if;

  member_team_id := target_member.team_id;

  if not public.has_current_device_access(member_team_id) then
    raise exception 'Current device is not approved';
  end if;

  if target_member.first_name_normalized = 'takashi'
    and public.current_member_id() is distinct from target_member_id then
    raise exception 'This profile cannot be selected from this device.';
  end if;

  update public.member_device_links
  set unlinked_at = now()
  where auth_user_id = auth.uid()
    and unlinked_at is null;

  insert into public.member_device_links (member_id, auth_user_id)
  values (target_member_id, auth.uid());

  return target_member_id;
end;
$$;
