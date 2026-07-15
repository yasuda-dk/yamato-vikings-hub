create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete restrict,
  auth_user_id uuid not null,
  member_id uuid not null references public.members(id) on delete restrict,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz
);

create index if not exists push_subscriptions_team_id_idx on public.push_subscriptions(team_id);
create index if not exists push_subscriptions_auth_user_id_idx on public.push_subscriptions(auth_user_id);
create index if not exists push_subscriptions_member_id_idx on public.push_subscriptions(member_id);

drop trigger if exists push_subscriptions_touch_updated_at on public.push_subscriptions;
create trigger push_subscriptions_touch_updated_at
before update on public.push_subscriptions
for each row execute function public.touch_updated_at();

alter table public.push_subscriptions enable row level security;

drop policy if exists "Members can read their own push subscriptions" on public.push_subscriptions;
create policy "Members can read their own push subscriptions"
on public.push_subscriptions for select
using (
  auth_user_id = auth.uid()
  and public.has_current_device_access(team_id)
);

create table if not exists public.practice_payment_reminder_deliveries (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete restrict,
  event_id uuid not null references public.events(id) on delete restrict,
  member_id uuid not null references public.members(id) on delete restrict,
  push_subscription_id uuid not null references public.push_subscriptions(id) on delete restrict,
  reminder_kind text not null default 'friday_20_unpaid',
  sent_at timestamptz not null default now(),
  unique (event_id, push_subscription_id, reminder_kind)
);

create index if not exists practice_payment_reminder_deliveries_team_id_idx on public.practice_payment_reminder_deliveries(team_id);
create index if not exists practice_payment_reminder_deliveries_event_id_idx on public.practice_payment_reminder_deliveries(event_id);
create index if not exists practice_payment_reminder_deliveries_member_id_idx on public.practice_payment_reminder_deliveries(member_id);

alter table public.practice_payment_reminder_deliveries enable row level security;

create or replace function public.practice_payment_reminder_targets(
  target_team_id uuid,
  target_practice_date date
)
returns table (
  subscription_id uuid,
  endpoint text,
  p256dh text,
  auth text,
  member_id uuid,
  first_name text,
  event_id uuid,
  event_date date,
  amount_dkk integer
)
language sql
stable
security definer
set search_path = public
as $$
  select
    ps.id as subscription_id,
    ps.endpoint,
    ps.p256dh,
    ps.auth,
    m.id as member_id,
    m.first_name,
    e.id as event_id,
    e.event_date,
    public.practice_payment_amount(m) as amount_dkk
  from public.events e
  join public.attendance a on a.event_id = e.id
  join public.members m on m.id = a.member_id
  join public.push_subscriptions ps
    on ps.member_id = m.id
    and ps.team_id = e.team_id
    and ps.is_active
    and ps.revoked_at is null
  left join public.practice_payments pp
    on pp.event_id = e.id
    and pp.member_id = m.id
  where e.team_id = target_team_id
    and e.title = 'Practice'
    and e.event_type = 'Football'
    and e.status <> 'Cancelled'
    and e.event_date = target_practice_date
    and a.rsvp_status = 'Going'
    and m.membership_status = 'Active'
    and m.practice_payment_rule <> 'Exempt'
    and public.practice_payment_amount(m) > 0
    and pp.id is null
    and not exists (
      select 1
      from public.practice_payment_reminder_deliveries delivered
      where delivered.event_id = e.id
        and delivered.push_subscription_id = ps.id
        and delivered.reminder_kind = 'friday_20_unpaid'
    )
  order by m.first_name, ps.created_at;
$$;

grant execute on function public.practice_payment_reminder_targets(uuid, date) to service_role;
