do $$
begin
  if not exists (select 1 from pg_type where typname = 'fine_payment_status' and typnamespace = 'public'::regnamespace) then
    create type public.fine_payment_status as enum ('Unpaid', 'Payment reported', 'Paid', 'Waived');
  end if;
end $$;

create table public.fine_types (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete restrict,
  name text not null,
  default_amount_dkk integer not null check (default_amount_dkk >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (team_id, name)
);

create table public.fines (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete restrict,
  season_id uuid references public.seasons(id) on delete restrict,
  member_id uuid references public.members(id) on delete restrict,
  event_guest_id uuid references public.event_guests(id) on delete restrict,
  fine_type_id uuid references public.fine_types(id) on delete set null,
  event_id uuid references public.events(id) on delete restrict,
  description text not null,
  amount_dkk integer not null check (amount_dkk > 0),
  payment_status public.fine_payment_status not null default 'Unpaid',
  private_admin_note text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  payment_reported_at timestamptz,
  payment_confirmed_by uuid references auth.users(id) on delete set null,
  payment_confirmed_at timestamptz,
  waived_by uuid references auth.users(id) on delete set null,
  waived_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint fines_exactly_one_participant check (
    (member_id is not null and event_guest_id is null)
    or (member_id is null and event_guest_id is not null)
  )
);

create index fine_types_team_id_idx on public.fine_types(team_id);
create index fines_team_id_idx on public.fines(team_id);
create index fines_member_id_idx on public.fines(member_id);
create index fines_event_guest_id_idx on public.fines(event_guest_id);
create index fines_payment_status_idx on public.fines(payment_status);

create trigger fine_types_touch_updated_at
before update on public.fine_types
for each row execute function public.touch_updated_at();

create trigger fines_touch_updated_at
before update on public.fines
for each row execute function public.touch_updated_at();

alter table public.fine_types enable row level security;
alter table public.fines enable row level security;

create policy "Approved devices can read active fine types"
on public.fine_types
for select
using (public.has_current_device_access(team_id));

create policy "Approved devices can read public fines"
on public.fines
for select
using (public.has_current_device_access(team_id));

create or replace function public.list_fine_box(target_team_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  settings jsonb;
  summary jsonb;
  fine_rows jsonb;
begin
  if not public.has_current_device_access(target_team_id) then
    raise exception 'Current device is not approved';
  end if;

  select jsonb_build_object(
    'mobilepay_box_number', ts.mobilepay_box_number,
    'mobilepay_url', ts.mobilepay_url,
    'payment_instructions', ts.payment_instructions
  )
  into settings
  from public.team_settings ts
  where ts.team_id = target_team_id;

  select jsonb_build_object(
    'unpaid_total_dkk', coalesce(sum(amount_dkk) filter (where payment_status = 'Unpaid'), 0),
    'payment_reported_total_dkk', coalesce(sum(amount_dkk) filter (where payment_status = 'Payment reported'), 0),
    'paid_total_dkk', coalesce(sum(amount_dkk) filter (where payment_status = 'Paid'), 0),
    'waived_total_dkk', coalesce(sum(amount_dkk) filter (where payment_status = 'Waived'), 0)
  )
  into summary
  from public.fines
  where team_id = target_team_id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', f.id,
        'participant_kind', case when f.member_id is not null then 'member' else 'guest' end,
        'participant_id', coalesce(f.member_id, f.event_guest_id),
        'first_name', coalesce(m.first_name, guest.first_name),
        'fine_type_name', ft.name,
        'description', f.description,
        'amount_dkk', f.amount_dkk,
        'payment_status', f.payment_status,
        'related_event_title', e.title,
        'related_event_date', e.event_date,
        'created_at', f.created_at,
        'payment_reported_at', f.payment_reported_at,
        'payment_confirmed_at', f.payment_confirmed_at,
        'waived_at', f.waived_at
      )
      order by
        case f.payment_status
          when 'Unpaid' then 1
          when 'Payment reported' then 2
          when 'Paid' then 3
          when 'Waived' then 4
        end,
        coalesce(m.first_name, guest.first_name),
        f.created_at desc
    ),
    '[]'::jsonb
  )
  into fine_rows
  from public.fines f
  left join public.members m on m.id = f.member_id
  left join public.event_guests guest on guest.id = f.event_guest_id
  left join public.fine_types ft on ft.id = f.fine_type_id
  left join public.events e on e.id = f.event_id
  where f.team_id = target_team_id;

  return jsonb_build_object(
    'settings', coalesce(settings, '{}'::jsonb),
    'summary', coalesce(summary, jsonb_build_object('unpaid_total_dkk', 0, 'payment_reported_total_dkk', 0, 'paid_total_dkk', 0, 'waived_total_dkk', 0)),
    'fines', fine_rows
  );
end;
$$;

create or replace function public.report_fine_payment(
  target_team_id uuid,
  p_fine_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  active_member_id uuid := public.current_member_id();
  updated_count integer;
begin
  if active_member_id is null then
    raise exception 'Select a member profile before reporting payment';
  end if;

  if not public.has_current_device_access(target_team_id) then
    raise exception 'Current device is not approved';
  end if;

  if p_fine_ids is null or cardinality(p_fine_ids) = 0 then
    raise exception 'Select at least one fine';
  end if;

  if exists (
    select 1
    from public.fines f
    where f.id = any(p_fine_ids)
      and (
        f.team_id <> target_team_id
        or f.member_id <> active_member_id
        or f.event_guest_id is not null
        or f.payment_status <> 'Unpaid'
      )
  ) then
    raise exception 'Only your unpaid member fines can be reported';
  end if;

  update public.fines
  set
    payment_status = 'Payment reported',
    payment_reported_at = now()
  where team_id = target_team_id
    and member_id = active_member_id
    and event_guest_id is null
    and payment_status = 'Unpaid'
    and id = any(p_fine_ids);

  get diagnostics updated_count = row_count;

  if updated_count <> cardinality(p_fine_ids) then
    raise exception 'Only your unpaid member fines can be reported';
  end if;

  return public.list_fine_box(target_team_id);
end;
$$;

grant execute on function public.list_fine_box(uuid) to authenticated;
grant execute on function public.report_fine_payment(uuid, uuid[]) to authenticated;
