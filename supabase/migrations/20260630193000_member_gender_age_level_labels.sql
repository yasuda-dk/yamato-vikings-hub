do $$
begin
  if exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'age_group'
      and e.enumlabel = '40+'
  ) then
    alter type public.age_group rename value '40+' to '40–49';
  end if;
end;
$$;

alter type public.age_group add value if not exists '50+';

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'gender_type'
  ) then
    create type public.gender_type as enum ('Male', 'Female', 'Non-binary', 'Other', 'Not specified');
  end if;
end;
$$;

alter table public.members
add column if not exists gender public.gender_type not null default 'Not specified';

create or replace function public.register_member_profile(
  target_team_id uuid,
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
  new_member_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required';
  end if;

  if not public.has_current_device_access(target_team_id) then
    raise exception 'Current device is not approved';
  end if;

  insert into public.members (
    team_id,
    first_name,
    first_name_normalized,
    age_group,
    football_level,
    primary_position,
    secondary_position,
    residence_type,
    gender
  )
  values (
    target_team_id,
    p_first_name,
    public.normalize_first_name(p_first_name),
    p_age_group,
    p_football_level,
    p_primary_position,
    p_secondary_position,
    p_residence_type,
    p_gender
  )
  returning id into new_member_id;

  insert into public.member_public_history (member_id, event_type, public_description)
  values (new_member_id, 'Profile created', 'Profile created');

  perform public.select_member_profile(new_member_id);

  return new_member_id;
exception
  when unique_violation then
    raise exception 'This name is already in use. Please choose another name or nickname.';
end;
$$;

create or replace function public.update_own_member_profile(
  p_age_group public.age_group,
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
  active_member_id uuid := public.current_member_id();
begin
  if active_member_id is null then
    raise exception 'No active member profile selected';
  end if;

  update public.members
  set
    age_group = p_age_group,
    primary_position = p_primary_position,
    secondary_position = p_secondary_position,
    residence_type = p_residence_type,
    gender = p_gender
  where id = active_member_id;

  insert into public.member_public_history (member_id, event_type, public_description)
  values (active_member_id, 'Profile updated', 'Updated profile details');

  return active_member_id;
end;
$$;

grant execute on function public.register_member_profile(uuid, text, public.age_group, integer, public.position_code, public.position_code, public.residence_type, public.gender_type) to authenticated;
grant execute on function public.update_own_member_profile(public.age_group, public.position_code, public.position_code, public.residence_type, public.gender_type) to authenticated;
