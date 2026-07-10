alter type public.age_group add value if not exists 'Under 18' before 'Under 25';

create table if not exists public.practice_payments (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete restrict,
  event_id uuid not null references public.events(id) on delete restrict,
  member_id uuid not null references public.members(id) on delete restrict,
  amount_dkk integer not null check (amount_dkk > 0),
  paid_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, member_id)
);

create index if not exists practice_payments_team_id_idx on public.practice_payments(team_id);
create index if not exists practice_payments_event_id_idx on public.practice_payments(event_id);
create index if not exists practice_payments_member_id_idx on public.practice_payments(member_id);

drop trigger if exists practice_payments_touch_updated_at on public.practice_payments;
create trigger practice_payments_touch_updated_at
before update on public.practice_payments
for each row execute function public.touch_updated_at();

alter table public.practice_payments enable row level security;

drop policy if exists "Approved devices can read practice payments" on public.practice_payments;
create policy "Approved devices can read practice payments"
on public.practice_payments for select
using (
  public.has_current_device_access(team_id)
  and (
    public.is_admin(team_id)
    or member_id = public.current_member_id()
  )
);

create or replace function public.practice_payment_amount(member_row public.members)
returns integer
language sql
immutable
set search_path = public
as $$
  select case
    when member_row.age_group::text = 'Under 18' or member_row.residence_type = 'Student' then 20
    else 80
  end;
$$;

create or replace function public.current_practice_event(target_team_id uuid)
returns public.events
language sql
stable
security definer
set search_path = public
as $$
  with today as (
    select (now() at time zone 'Europe/Copenhagen')::date as value
  )
  select e
  from public.events e, today
  where e.team_id = target_team_id
    and e.title = 'Practice'
    and e.event_type = 'Football'
    and e.status <> 'Cancelled'
    and today.value <= e.event_date + 1
    and e.event_date <= today.value + 7
  order by e.event_date asc, e.start_time asc
  limit 1;
$$;

create or replace function public.get_practice_payment_state(target_team_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  active_member_id uuid := public.current_member_id();
  active_member public.members%rowtype;
  practice_event public.events%rowtype;
  my_rsvp public.rsvp_status;
  my_paid_at timestamptz;
  admin_rows jsonb := '[]'::jsonb;
  expected_total integer := 0;
  paid_total integer := 0;
  paid_count integer := 0;
  unpaid_count integer := 0;
begin
  if not public.has_current_device_access(target_team_id) then
    raise exception 'Current device is not approved';
  end if;

  if active_member_id is null then
    raise exception 'No active member profile selected';
  end if;

  select * into active_member
  from public.members
  where id = active_member_id
    and team_id = target_team_id;

  if active_member.id is null then
    raise exception 'No active member profile selected';
  end if;

  select * into practice_event
  from public.current_practice_event(target_team_id);

  if practice_event.id is null then
    return jsonb_build_object(
      'event', null,
      'myPayment', null,
      'adminPayments', '[]'::jsonb,
      'totals', jsonb_build_object(
        'expected_total_dkk', 0,
        'paid_total_dkk', 0,
        'unpaid_total_dkk', 0,
        'paid_count', 0,
        'unpaid_count', 0
      )
    );
  end if;

  select a.rsvp_status into my_rsvp
  from public.attendance a
  where a.event_id = practice_event.id
    and a.member_id = active_member_id;

  select pp.paid_at into my_paid_at
  from public.practice_payments pp
  where pp.event_id = practice_event.id
    and pp.member_id = active_member_id;

  select
    coalesce(jsonb_agg(
      jsonb_build_object(
        'member_id', member_payments.member_id,
        'first_name', member_payments.first_name,
        'amount_dkk', member_payments.amount_dkk,
        'rsvp_status', 'Going',
        'is_paid', member_payments.paid_at is not null,
        'paid_at', member_payments.paid_at
      )
      order by member_payments.is_paid asc, member_payments.first_name
    ), '[]'::jsonb),
    coalesce(sum(member_payments.amount_dkk), 0),
    coalesce(sum(member_payments.amount_dkk) filter (where member_payments.paid_at is not null), 0),
    count(*) filter (where member_payments.paid_at is not null),
    count(*) filter (where member_payments.paid_at is null)
  into admin_rows, expected_total, paid_total, paid_count, unpaid_count
  from (
    select
      m.id as member_id,
      m.first_name,
      public.practice_payment_amount(m) as amount_dkk,
      pp.paid_at,
      pp.paid_at is not null as is_paid
    from public.attendance a
    join public.members m on m.id = a.member_id
    left join public.practice_payments pp
      on pp.event_id = a.event_id
      and pp.member_id = a.member_id
    where a.event_id = practice_event.id
      and a.rsvp_status = 'Going'
      and m.team_id = target_team_id
      and m.membership_status = 'Active'
  ) member_payments;

  return jsonb_build_object(
    'event', jsonb_build_object(
      'id', practice_event.id,
      'title', practice_event.title,
      'event_date', practice_event.event_date,
      'start_time', practice_event.start_time,
      'location', practice_event.location,
      'payment_deadline_date', practice_event.event_date + 1
    ),
    'myPayment', jsonb_build_object(
      'member_id', active_member.id,
      'first_name', active_member.first_name,
      'amount_dkk', public.practice_payment_amount(active_member),
      'rsvp_status', my_rsvp,
      'is_paid', my_paid_at is not null,
      'paid_at', my_paid_at
    ),
    'adminPayments', case when public.is_admin(target_team_id) then admin_rows else '[]'::jsonb end,
    'totals', jsonb_build_object(
      'expected_total_dkk', case when public.is_admin(target_team_id) then expected_total else 0 end,
      'paid_total_dkk', case when public.is_admin(target_team_id) then paid_total else 0 end,
      'unpaid_total_dkk', case when public.is_admin(target_team_id) then expected_total - paid_total else 0 end,
      'paid_count', case when public.is_admin(target_team_id) then paid_count else 0 end,
      'unpaid_count', case when public.is_admin(target_team_id) then unpaid_count else 0 end
    )
  );
end;
$$;

create or replace function public.mark_practice_payment_paid(
  target_team_id uuid,
  target_event_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  active_member_id uuid := public.current_member_id();
  active_member public.members%rowtype;
  target_event public.events%rowtype;
  today date := (now() at time zone 'Europe/Copenhagen')::date;
  amount integer;
begin
  if not public.has_current_device_access(target_team_id) then
    raise exception 'Current device is not approved';
  end if;

  if active_member_id is null then
    raise exception 'No active member profile selected';
  end if;

  select * into active_member
  from public.members
  where id = active_member_id
    and team_id = target_team_id
    and membership_status = 'Active';

  if active_member.id is null then
    raise exception 'No active member profile selected';
  end if;

  select * into target_event
  from public.events
  where id = target_event_id
    and team_id = target_team_id
    and title = 'Practice'
    and event_type = 'Football'
    and status <> 'Cancelled';

  if target_event.id is null then
    raise exception 'Practice event not found';
  end if;

  if today > target_event.event_date + 1 then
    raise exception 'Practice payment deadline has passed';
  end if;

  if not exists (
    select 1
    from public.attendance a
    where a.event_id = target_event_id
      and a.member_id = active_member_id
      and a.rsvp_status = 'Going'
  ) then
    raise exception 'Only Going members can mark practice payment paid.';
  end if;

  amount := public.practice_payment_amount(active_member);

  insert into public.practice_payments (
    team_id,
    event_id,
    member_id,
    amount_dkk,
    paid_at
  )
  values (
    target_team_id,
    target_event_id,
    active_member_id,
    amount,
    now()
  )
  on conflict (event_id, member_id)
  do update set
    amount_dkk = excluded.amount_dkk,
    paid_at = excluded.paid_at;

  return public.get_practice_payment_state(target_team_id);
end;
$$;

grant execute on function public.practice_payment_amount(public.members) to authenticated;
grant execute on function public.current_practice_event(uuid) to authenticated;
grant execute on function public.get_practice_payment_state(uuid) to authenticated;
grant execute on function public.mark_practice_payment_paid(uuid, uuid) to authenticated;
