create extension if not exists pgcrypto with schema extensions;

create type public.age_group as enum (
  'Under 25',
  '25–29',
  '30–34',
  '35–39',
  '40–49',
  '50+',
  'Not specified'
);

create type public.residence_type as enum (
  'Local resident',
  'Expat',
  'Student',
  'Working holiday',
  'Other',
  'Not specified'
);

create type public.position_code as enum ('FW', 'MF', 'DF');
create type public.gender_type as enum ('Male', 'Female', 'Non-binary', 'Other', 'Not specified');
create type public.membership_status as enum ('Active', 'Inactive');
create type public.application_role as enum ('Player', 'Admin');

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table public.team_settings (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null unique references public.teams(id) on delete restrict,
  mobilepay_box_number text,
  mobilepay_url text,
  payment_instructions text,
  team_password_hash text,
  access_version integer not null default 1 check (access_version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.device_access (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete restrict,
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  access_version integer not null,
  granted_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique (team_id, auth_user_id, access_version)
);

create table public.members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete restrict,
  first_name text not null,
  first_name_normalized text not null,
  age_group public.age_group not null default 'Not specified',
  football_level integer not null check (football_level between 1 and 5),
  primary_position public.position_code not null,
  secondary_position public.position_code,
  residence_type public.residence_type not null default 'Not specified',
  gender public.gender_type not null default 'Not specified',
  membership_status public.membership_status not null default 'Active',
  application_role public.application_role not null default 'Player',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint members_first_name_not_blank check (length(first_name_normalized) > 0),
  constraint members_secondary_differs_from_primary check (secondary_position is null or secondary_position <> primary_position),
  unique (team_id, first_name_normalized)
);

create table public.member_device_links (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete restrict,
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  linked_at timestamptz not null default now(),
  last_used_at timestamptz not null default now(),
  unlinked_at timestamptz
);

create unique index member_device_links_one_active_per_device
  on public.member_device_links(auth_user_id)
  where unlinked_at is null;

create table public.member_public_history (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete restrict,
  event_type text not null,
  public_description text not null,
  created_at timestamptz not null default now()
);

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete restrict,
  actor_auth_user_id uuid references auth.users(id) on delete set null,
  entity_type text not null,
  entity_id uuid,
  action text not null,
  old_value jsonb,
  new_value jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.normalize_first_name(input text)
returns text
language sql
immutable
strict
as $$
  select lower(regexp_replace(btrim(input), '\s+', ' ', 'g'));
$$;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger team_settings_touch_updated_at
before update on public.team_settings
for each row execute function public.touch_updated_at();

create trigger members_touch_updated_at
before update on public.members
for each row execute function public.touch_updated_at();

create or replace function public.set_member_first_name_normalized()
returns trigger
language plpgsql
as $$
begin
  new.first_name = regexp_replace(btrim(new.first_name), '\s+', ' ', 'g');
  new.first_name_normalized = public.normalize_first_name(new.first_name);
  return new;
end;
$$;

create trigger members_normalize_first_name
before insert or update of first_name on public.members
for each row execute function public.set_member_first_name_normalized();

create or replace function public.has_current_device_access(target_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.device_access da
    join public.team_settings ts on ts.team_id = da.team_id
    where da.team_id = target_team_id
      and da.auth_user_id = auth.uid()
      and da.revoked_at is null
      and da.access_version = ts.access_version
  );
$$;

create or replace function public.current_member_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select mdl.member_id
  from public.member_device_links mdl
  join public.members m on m.id = mdl.member_id
  where mdl.auth_user_id = auth.uid()
    and mdl.unlinked_at is null
    and public.has_current_device_access(m.team_id)
  limit 1;
$$;

create or replace function public.is_admin(target_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.member_device_links mdl
    join public.members m on m.id = mdl.member_id
    where mdl.auth_user_id = auth.uid()
      and mdl.unlinked_at is null
      and m.team_id = target_team_id
      and m.application_role = 'Admin'
      and m.membership_status = 'Active'
      and public.has_current_device_access(target_team_id)
  );
$$;

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

create or replace function public.select_member_profile(target_member_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  member_team_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required';
  end if;

  select team_id into member_team_id
  from public.members
  where id = target_member_id;

  if member_team_id is null then
    raise exception 'Member not found';
  end if;

  if not public.has_current_device_access(member_team_id) then
    raise exception 'Current device is not approved';
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

create or replace function public.reset_device_access(target_team_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  next_version integer;
begin
  if not public.is_admin(target_team_id) then
    raise exception 'Admin permission is required';
  end if;

  update public.team_settings
  set access_version = access_version + 1
  where team_id = target_team_id
  returning access_version into next_version;

  return next_version;
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

insert into public.teams (id, name)
values ('00000000-0000-0000-0000-000000000001', 'Yamato Vikings')
on conflict (id) do nothing;

insert into public.team_settings (
  team_id,
  mobilepay_box_number,
  mobilepay_url,
  payment_instructions
)
values (
  '00000000-0000-0000-0000-000000000001',
  '2391JB',
  'https://qr.mobilepay.dk/box/703316ba-f36a-4335-9a16-f2ffbc1a02f8/pay-in',
  'Use your first name as the payment reference.'
)
on conflict (team_id) do nothing;

alter table public.teams enable row level security;
alter table public.team_settings enable row level security;
alter table public.device_access enable row level security;
alter table public.members enable row level security;
alter table public.member_device_links enable row level security;
alter table public.member_public_history enable row level security;
alter table public.audit_log enable row level security;

create policy "Approved devices can read teams"
on public.teams for select
using (public.has_current_device_access(id));

create policy "Approved devices can read public team settings"
on public.team_settings for select
using (public.has_current_device_access(team_id));

create policy "Users can read their own current device access"
on public.device_access for select
using (auth.uid() = auth_user_id);

create policy "Approved devices can read public member profiles"
on public.members for select
using (public.has_current_device_access(team_id));

create policy "Members can update their editable profile fields"
on public.members for update
using (id = public.current_member_id())
with check (
  id = public.current_member_id()
  and first_name = (select first_name from public.members existing where existing.id = members.id)
  and football_level = (select football_level from public.members existing where existing.id = members.id)
  and membership_status = (select membership_status from public.members existing where existing.id = members.id)
  and application_role = (select application_role from public.members existing where existing.id = members.id)
);

create policy "Admins can update members in their team"
on public.members for update
using (public.is_admin(team_id))
with check (public.is_admin(team_id));

create policy "Users can read their own member device links"
on public.member_device_links for select
using (auth.uid() = auth_user_id);

create policy "Approved devices can read public member history"
on public.member_public_history for select
using (
  exists (
    select 1
    from public.members m
    where m.id = member_public_history.member_id
      and public.has_current_device_access(m.team_id)
  )
);

create policy "Admins can read audit log"
on public.audit_log for select
using (public.is_admin(team_id));

grant execute on function public.normalize_first_name(text) to anon, authenticated;
grant execute on function public.has_current_device_access(uuid) to anon, authenticated;
grant execute on function public.current_member_id() to anon, authenticated;
grant execute on function public.is_admin(uuid) to anon, authenticated;
grant execute on function public.verify_team_password(uuid, text) to authenticated;
grant execute on function public.select_member_profile(uuid) to authenticated;
grant execute on function public.register_member_profile(uuid, text, public.age_group, integer, public.position_code, public.position_code, public.residence_type, public.gender_type) to authenticated;
grant execute on function public.update_own_member_profile(public.age_group, public.position_code, public.position_code, public.residence_type, public.gender_type) to authenticated;
grant execute on function public.reset_device_access(uuid) to authenticated;
grant execute on function public.change_team_password(uuid, text) to authenticated;
