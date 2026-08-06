create or replace function public.practice_payment_tracking_for_event(
  target_team_id uuid,
  target_event_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  target_event public.events%rowtype;
  payment_rows jsonb := '[]'::jsonb;
  expected_total integer := 0;
  paid_total integer := 0;
  paid_count integer := 0;
  unpaid_count integer := 0;
  exempt_count integer := 0;
begin
  select * into target_event
  from public.events
  where id = target_event_id
    and team_id = target_team_id
    and title ilike 'Practice%'
    and event_type = 'Football'
    and status <> 'Cancelled';

  if target_event.id is null then
    raise exception 'Practice event not found';
  end if;

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
      order by member_payments.is_exempt asc, member_payments.paid_at is null desc, member_payments.first_name
    ), '[]'::jsonb),
    coalesce(sum(member_payments.amount_dkk), 0),
    coalesce(sum(member_payments.amount_dkk) filter (where member_payments.paid_at is not null and not member_payments.is_exempt), 0),
    count(*) filter (where member_payments.paid_at is not null and not member_payments.is_exempt),
    count(*) filter (where member_payments.paid_at is null and not member_payments.is_exempt),
    count(*) filter (where member_payments.is_exempt)
  into payment_rows, expected_total, paid_total, paid_count, unpaid_count, exempt_count
  from (
    select
      m.id as member_id,
      m.first_name,
      case
        when m.practice_payment_rule = 'Exempt' then 0
        else coalesce(pp.amount_dkk, public.practice_payment_amount(m))
      end as amount_dkk,
      m.practice_payment_rule as payment_rule,
      m.practice_payment_rule = 'Exempt' as is_exempt,
      pp.paid_at
    from public.attendance a
    join public.members m on m.id = a.member_id
    left join public.practice_payments pp
      on pp.event_id = a.event_id
      and pp.member_id = a.member_id
    where a.event_id = target_event_id
      and a.rsvp_status = 'Going'
      and m.team_id = target_team_id
  ) member_payments;

  return jsonb_build_object(
    'event', jsonb_build_object(
      'id', target_event.id,
      'title', target_event.title,
      'event_date', target_event.event_date,
      'start_time', target_event.start_time,
      'location', target_event.location,
      'payment_deadline_date', target_event.event_date + 1
    ),
    'payments', payment_rows,
    'totals', jsonb_build_object(
      'expected_total_dkk', expected_total,
      'paid_total_dkk', paid_total,
      'unpaid_total_dkk', expected_total - paid_total,
      'paid_count', paid_count,
      'unpaid_count', unpaid_count,
      'exempt_count', exempt_count
    )
  );
end;
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
      public.is_admin(target_team_id) as is_admin
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
      (e.event_date <= c.today and c.today <= e.event_date + 1) as is_current_payment_window,
      (e.event_date >= c.today and e.event_date <= c.today + 7) as is_upcoming,
      (c.is_admin and e.event_date <= c.today and c.today <= e.event_date + 7) as is_admin_tracking_window,
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
    cross join context c
    where e.team_id = target_team_id
      and e.title ilike 'Practice%'
      and e.event_type = 'Football'
      and e.status <> 'Cancelled'
  )
  select candidate.event_row
  from candidate_events candidate
  where candidate.is_current_payment_window
    or candidate.is_unpaid_for_current_member
    or candidate.is_admin_tracking_window
    or candidate.is_upcoming
  order by
    case
      when candidate.is_current_payment_window then 0
      when candidate.is_unpaid_for_current_member then 1
      when candidate.is_admin_tracking_window then 2
      else 3
    end,
    case
      when candidate.is_admin_tracking_window and not candidate.is_current_payment_window
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
  history_rows jsonb := '[]'::jsonb;
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

  if can_track_payments then
    select coalesce(jsonb_agg(public.practice_payment_tracking_for_event(target_team_id, e.id) order by e.event_date desc, e.start_time desc), '[]'::jsonb)
    into history_rows
    from public.events e
    where e.team_id = target_team_id
      and e.title ilike 'Practice%'
      and e.event_type = 'Football'
      and e.status <> 'Cancelled'
      and e.event_date < (now() at time zone 'Europe/Copenhagen')::date;
  end if;

  select * into practice_event
  from public.current_practice_event(target_team_id);

  if practice_event.id is null then
    return jsonb_build_object(
      'event', null,
      'myPayment', null,
      'adminPayments', '[]'::jsonb,
      'practiceHistory', history_rows,
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
    'practiceHistory', history_rows,
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
    and title ilike 'Practice%'
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
