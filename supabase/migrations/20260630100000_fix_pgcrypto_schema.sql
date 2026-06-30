create extension if not exists pgcrypto with schema extensions;

create or replace function public.verify_team_password(target_team_id uuid, plain_password text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  settings record;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required';
  end if;

  select team_password_hash, access_version
  into settings
  from public.team_settings
  where team_id = target_team_id;

  if settings.team_password_hash is null then
    raise exception 'Team password is not configured';
  end if;

  if settings.team_password_hash = extensions.crypt(plain_password, settings.team_password_hash) then
    insert into public.device_access (team_id, auth_user_id, access_version)
    values (target_team_id, auth.uid(), settings.access_version)
    on conflict (team_id, auth_user_id, access_version)
    do update set last_seen_at = now(), revoked_at = null;
    return true;
  end if;

  return false;
end;
$$;

create or replace function public.change_team_password(target_team_id uuid, new_plain_password text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin(target_team_id) then
    raise exception 'Admin permission is required';
  end if;

  update public.team_settings
  set
    team_password_hash = extensions.crypt(new_plain_password, extensions.gen_salt('bf')),
    access_version = access_version + 1
  where team_id = target_team_id;
end;
$$;

create or replace function public.initialize_team_password(target_team_id uuid, new_plain_password text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_hash text;
begin
  select team_password_hash
  into existing_hash
  from public.team_settings
  where team_id = target_team_id
  for update;

  if existing_hash is not null then
    raise exception 'Team password is already configured';
  end if;

  update public.team_settings
  set team_password_hash = extensions.crypt(new_plain_password, extensions.gen_salt('bf'))
  where team_id = target_team_id;
end;
$$;

grant execute on function public.verify_team_password(uuid, text) to authenticated;
grant execute on function public.change_team_password(uuid, text) to authenticated;
grant execute on function public.initialize_team_password(uuid, text) to service_role;
