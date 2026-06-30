drop policy if exists "Members can update their editable profile fields" on public.members;

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

grant execute on function public.initialize_team_password(uuid, text) to service_role;
