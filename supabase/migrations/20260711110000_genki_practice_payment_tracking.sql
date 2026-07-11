create or replace function public.can_view_practice_payment_tracking(target_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin(target_team_id)
    or exists (
      select 1
      from public.members m
      where m.id = public.current_member_id()
        and m.team_id = target_team_id
        and m.membership_status = 'Active'
        and m.first_name_normalized = 'genki'
        and public.has_current_device_access(target_team_id)
    );
$$;

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
      public.current_member_id() as member_id,
      public.can_view_practice_payment_tracking(target_team_id) as can_track_payments
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
      c.can_track_payments
      and (candidate.event_row).event_date <= c.today
      and c.today <= (candidate.event_row).event_date + 7
    )
    or (
      (candidate.event_row).event_date >= c.today
      and (candidate.event_row).event_date <= c.today + 7
    )
  order by
    case
      when candidate.is_unpaid_for_current_member then 0
      when c.can_track_payments
        and (candidate.event_row).event_date <= c.today
        and c.today <= (candidate.event_row).event_date + 7 then 1
      else 2
    end,
    case
      when c.can_track_payments
        and (candidate.event_row).event_date <= c.today
        and c.today <= (candidate.event_row).event_date + 7
        then (candidate.event_row).event_date
    end desc,
    (candidate.event_row).event_date asc,
    (candidate.event_row).start_time asc
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
  can_track_payments boolean := false;
  admin_rows jsonb := '[]'::jsonb;
  expected_total integer := 0;
  paid_total integer := 0;
  paid_count integer := 0;
  unpaid_count integer := 0;
  exempt_count integer := 0;
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

  can_track_payments := public.can_view_practice_payment_tracking(target_team_id);

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
        'unpaid_count', 0,
        'exempt_count', 0
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
        'payment_rule', member_payments.payment_rule,
        'is_exempt', member_payments.is_exempt,
        'rsvp_status', 'Going',
        'is_paid', member_payments.paid_at is not null,
        'paid_at', member_payments.paid_at
      )
      order by member_payments.is_exempt asc, member_payments.is_paid asc, member_payments.first_name
    ), '[]'::jsonb),
    coalesce(sum(member_payments.amount_dkk), 0),
    coalesce(sum(member_payments.amount_dkk) filter (where member_payments.paid_at is not null and not member_payments.is_exempt), 0),
    count(*) filter (where member_payments.paid_at is not null and not member_payments.is_exempt),
    count(*) filter (where member_payments.paid_at is null and not member_payments.is_exempt),
    count(*) filter (where member_payments.is_exempt)
  into admin_rows, expected_total, paid_total, paid_count, unpaid_count, exempt_count
  from (
    select
      m.id as member_id,
      m.first_name,
      public.practice_payment_amount(m) as amount_dkk,
      m.practice_payment_rule as payment_rule,
      m.practice_payment_rule = 'Exempt' as is_exempt,
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
      'payment_rule', active_member.practice_payment_rule,
      'is_exempt', active_member.practice_payment_rule = 'Exempt',
      'rsvp_status', my_rsvp,
      'is_paid', my_paid_at is not null,
      'paid_at', my_paid_at
    ),
    'adminPayments', case when can_track_payments then admin_rows else '[]'::jsonb end,
    'totals', jsonb_build_object(
      'expected_total_dkk', case when can_track_payments then expected_total else 0 end,
      'paid_total_dkk', case when can_track_payments then paid_total else 0 end,
      'unpaid_total_dkk', case when can_track_payments then expected_total - paid_total else 0 end,
      'paid_count', case when can_track_payments then paid_count else 0 end,
      'unpaid_count', case when can_track_payments then unpaid_count else 0 end,
      'exempt_count', case when can_track_payments then exempt_count else 0 end
    )
  );
end;
$$;

grant execute on function public.can_view_practice_payment_tracking(uuid) to authenticated;
