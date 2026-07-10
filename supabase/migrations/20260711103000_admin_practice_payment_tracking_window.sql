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
      c.is_admin
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
      when c.is_admin
        and (candidate.event_row).event_date <= c.today
        and c.today <= (candidate.event_row).event_date + 7 then 1
      else 2
    end,
    case
      when c.is_admin
        and (candidate.event_row).event_date <= c.today
        and c.today <= (candidate.event_row).event_date + 7
        then (candidate.event_row).event_date
    end desc,
    (candidate.event_row).event_date asc,
    (candidate.event_row).start_time asc
  limit 1;
$$;
