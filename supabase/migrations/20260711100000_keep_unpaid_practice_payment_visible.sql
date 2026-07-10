create or replace function public.current_practice_event(target_team_id uuid)
returns public.events
language sql
stable
security definer
set search_path = public
as $$
  with context as (
    select
      (now() at time zone 'Europe/Copenhagen')::date as today,
      public.current_member_id() as member_id
  ),
  active_member as (
    select m.*
    from public.members m, context c
    where m.id = c.member_id
      and m.team_id = target_team_id
      and m.membership_status = 'Active'
  ),
  candidate_events as (
    select
      e as event_row,
      exists (
        select 1
        from public.attendance a
        join active_member m on m.id = a.member_id
        left join public.practice_payments pp
          on pp.event_id = a.event_id
          and pp.member_id = a.member_id
        where a.event_id = e.id
          and a.rsvp_status = 'Going'
          and m.practice_payment_rule <> 'Exempt'
          and pp.id is null
      ) as is_unpaid_for_current_member
    from public.events e
    where e.team_id = target_team_id
      and e.title = 'Practice'
      and e.event_type = 'Football'
      and e.status <> 'Cancelled'
  )
  select candidate.event_row
  from candidate_events candidate, context c
  where candidate.is_unpaid_for_current_member
    or (
      (candidate.event_row).event_date >= c.today
      and (candidate.event_row).event_date <= c.today + 7
    )
  order by
    case when candidate.is_unpaid_for_current_member then 0 else 1 end,
    (candidate.event_row).event_date asc,
    (candidate.event_row).start_time asc
  limit 1;
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

  if active_member.practice_payment_rule = 'Exempt' then
    raise exception 'This member is exempt from Practice payment.';
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

  if amount <= 0 then
    raise exception 'Practice payment amount must be above 0 DKK.';
  end if;

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
