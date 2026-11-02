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
      'pitch_type', target_event.pitch_type,
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
