create or replace function public.admin_update_member(
  target_team_id uuid,
  p_member_id uuid,
  p_first_name text,
  p_age_group public.age_group,
  p_football_level integer,
  p_primary_position public.position_code,
  p_secondary_position public.position_code,
  p_residence_type public.residence_type,
  p_gender public.gender_type,
  p_membership_status public.membership_status,
  p_application_role public.application_role
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  active_member_id uuid := public.current_member_id();
  normalized_name text;
  previous_member public.members%rowtype;
  active_admin_count integer;
begin
  if not public.is_admin(target_team_id) then
    raise exception 'Admin permission is required';
  end if;

  select * into previous_member
  from public.members
  where id = p_member_id
    and team_id = target_team_id;

  if previous_member.id is null then
    raise exception 'Member not found';
  end if;

  normalized_name := public.normalize_first_name(p_first_name);

  if length(normalized_name) = 0 then
    raise exception 'First name is required.';
  end if;

  if p_football_level is null or p_football_level < 1 or p_football_level > 5 then
    raise exception 'Select a football level.';
  end if;

  select count(*) into active_admin_count
  from public.members
  where team_id = target_team_id
    and application_role = 'Admin'
    and membership_status = 'Active';

  if p_member_id = active_member_id
    and previous_member.application_role = 'Admin'
    and previous_member.membership_status = 'Active'
    and active_admin_count <= 1
    and (p_application_role <> 'Admin' or p_membership_status <> 'Active')
  then
    raise exception 'The final active Admin cannot remove their own Admin access.';
  end if;

  update public.members
  set
    first_name = btrim(regexp_replace(p_first_name, '\s+', ' ', 'g')),
    first_name_normalized = normalized_name,
    age_group = p_age_group,
    football_level = p_football_level,
    primary_position = p_primary_position,
    secondary_position = p_secondary_position,
    residence_type = p_residence_type,
    gender = p_gender,
    membership_status = p_membership_status,
    application_role = p_application_role
  where id = p_member_id
    and team_id = target_team_id;

  insert into public.member_public_history (member_id, event_type, public_description)
  values (p_member_id, 'Admin profile updated', 'Admin updated profile details');

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
    target_team_id,
    auth.uid(),
    'member',
    p_member_id,
    'admin_update_member',
    jsonb_build_object(
      'first_name', previous_member.first_name,
      'age_group', previous_member.age_group,
      'football_level', previous_member.football_level,
      'primary_position', previous_member.primary_position,
      'secondary_position', previous_member.secondary_position,
      'residence_type', previous_member.residence_type,
      'gender', previous_member.gender,
      'membership_status', previous_member.membership_status,
      'application_role', previous_member.application_role
    ),
    jsonb_build_object(
      'first_name', btrim(regexp_replace(p_first_name, '\s+', ' ', 'g')),
      'age_group', p_age_group,
      'football_level', p_football_level,
      'primary_position', p_primary_position,
      'secondary_position', p_secondary_position,
      'residence_type', p_residence_type,
      'gender', p_gender,
      'membership_status', p_membership_status,
      'application_role', p_application_role
    )
  );

  return p_member_id;
exception
  when unique_violation then
    raise exception 'This name is already in use. Please choose another name or nickname.';
end;
$$;

grant execute on function public.admin_update_member(uuid, uuid, text, public.age_group, integer, public.position_code, public.position_code, public.residence_type, public.gender_type, public.membership_status, public.application_role) to authenticated;
