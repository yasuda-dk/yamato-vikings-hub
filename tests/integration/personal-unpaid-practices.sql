-- Run after annual-awards.sql, inside the same rollback-only transaction.
reset role;
update public.members set membership_status = 'Active', practice_payment_rule = 'Custom', practice_payment_custom_amount_dkk = 35 where id = pg_temp.award_id('player_member');
update public.device_access set revoked_at = null where auth_user_id = pg_temp.award_id('player');
do $$
declare s uuid := gen_random_uuid(); e uuid; i integer;
begin
  insert into public.seasons (id, team_id, name, start_date, end_date)
  values (s, pg_temp.award_id('team'), 'Payment integration', '2020-01-01', '2099-12-31');
  for i in 1..10 loop
    e := gen_random_uuid();
    perform set_config('test.award_payment' || i, e::text, true);
    insert into public.events (id, team_id, season_id, title, event_type, event_date, start_time, location, rsvp_deadline, status)
    values (e, pg_temp.award_id('team'), s,
      case i when 9 then 'Practice 4 vs 4' when 10 then 'Friday Football' else 'Practice' end,
      case when i = 5 then 'Social'::public.event_type else 'Football'::public.event_type end,
      case i when 1 then '2023-01-01'::date when 6 then '2099-01-01'::date else '2024-01-01'::date end,
      '18:00', 'Test pitch', '2023-01-01T12:00:00Z',
      case i when 3 then 'Cancelled'::public.event_status when 4 then 'Draft'::public.event_status else 'Completed'::public.event_status end);
    insert into public.attendance (event_id, member_id, rsvp_status) values
      (e, pg_temp.award_id('player_member'), case i when 7 then 'Maybe'::public.rsvp_status when 8 then 'Not going'::public.rsvp_status else 'Going'::public.rsvp_status end),
      (e, pg_temp.award_id('owner_member'), 'Going');
    if i = 2 then
      insert into public.practice_payments (team_id, event_id, member_id, amount_dkk, paid_at)
      values (pg_temp.award_id('team'), e, pg_temp.award_id('player_member'), 35, '2024-01-02T18:00:00Z');
    end if;
  end loop;
end;
$$;
set local role authenticated;
select pg_temp.award_login('player');
do $$
declare rows jsonb;
begin
  rows := public.get_my_unpaid_practices(pg_temp.award_id('team'));
  perform pg_temp.assert_award(jsonb_array_length(rows) = 2, 'Unpaid filters or own-member isolation failed');
  perform pg_temp.assert_award(rows->0->>'id' = pg_temp.award_id('payment1')::text, 'Oldest unpaid Practice missing');
  perform pg_temp.assert_award(rows->1->>'id' = pg_temp.award_id('payment9')::text, 'Prefixed Practice missing');
  perform pg_temp.assert_award((select bool_and(r->>'amount_dkk' = '35' and not (r ? 'member_id') and not (r ? 'payments')) from jsonb_array_elements(rows) r), 'Wrong custom charge or leaked tracking data');
  perform pg_temp.assert_award(public.get_practice_payment_history(pg_temp.award_id('team')) = '[]'::jsonb, 'Member gained team history');
end;
$$;
select pg_temp.award_rejected($q$select public.get_my_unpaid_practices(pg_temp.award_id('other_team'))$q$, 'Current device');
select public.mark_practice_payment_paid(pg_temp.award_id('team'), pg_temp.award_id('payment1'));
select pg_temp.assert_award(jsonb_array_length(public.get_my_unpaid_practices(pg_temp.award_id('team'))) = 1, 'Paid Practice not removed');
select set_config('test.payment_first_paid_at', (select paid_at::text from public.practice_payments where event_id = pg_temp.award_id('payment1') and member_id = pg_temp.award_id('player_member')), true);
select public.mark_practice_payment_paid(pg_temp.award_id('team'), pg_temp.award_id('payment1'));
select pg_temp.assert_award((select paid_at::text = current_setting('test.payment_first_paid_at') from public.practice_payments where event_id = pg_temp.award_id('payment1') and member_id = pg_temp.award_id('player_member')), 'Repeated click overwrote payment timestamp');
select public.mark_practice_payment_paid(pg_temp.award_id('team'), pg_temp.award_id('payment9'));
select pg_temp.assert_award(public.get_my_unpaid_practices(pg_temp.award_id('team')) = '[]'::jsonb, 'Prefixed historical payment failed');
select pg_temp.award_rejected($q$select public.mark_practice_payment_paid(pg_temp.award_id('team'), pg_temp.award_id('payment3'))$q$, 'Practice event');
select pg_temp.award_rejected($q$select public.mark_practice_payment_paid(pg_temp.award_id('team'), pg_temp.award_id('payment7'))$q$, 'Only Going');
reset role;
select pg_temp.assert_award(not exists(select 1 from public.practice_payments where member_id = pg_temp.award_id('owner_member')), 'Marked another member paid');
update public.members set first_name = 'Genki', application_role = 'Player' where id = pg_temp.award_id('admin_member');
set local role authenticated;
select pg_temp.award_login('admin');
select pg_temp.assert_award(public.can_view_practice_payment_tracking(pg_temp.award_id('team')), 'Genki lost tracking access');
select pg_temp.assert_award(jsonb_array_length(public.get_practice_payment_history(pg_temp.award_id('team'))) > 0, 'Genki history changed');
select pg_temp.assert_award((public.practice_payment_tracking_for_event(pg_temp.award_id('team'), pg_temp.award_id('payment1'))->'totals'->>'paid_count')::integer = 1, 'Personal payment missing from Genki tracking');
select pg_temp.assert_award(public.get_my_unpaid_practices(pg_temp.award_id('team')) = '[]'::jsonb, 'Genki own list exposed another member');
reset role;
insert into public.events (team_id, season_id, title, event_type, event_date, start_time, location, rsvp_deadline, status)
select team_id, season_id, 'Practice Exempt', event_type, event_date, start_time, location, rsvp_deadline, status
from public.events where id = pg_temp.award_id('payment1');
insert into public.attendance (event_id, member_id, rsvp_status)
select id, pg_temp.award_id('player_member'), 'Going' from public.events where team_id = pg_temp.award_id('team') and title = 'Practice Exempt';
update public.members set practice_payment_rule = 'Exempt', practice_payment_custom_amount_dkk = null where id = pg_temp.award_id('player_member');
set local role authenticated;
select pg_temp.award_login('player');
select pg_temp.assert_award(public.get_my_unpaid_practices(pg_temp.award_id('team')) = '[]'::jsonb, 'Exempt member charged');
select pg_temp.award_rejected($q$select public.mark_practice_payment_paid(pg_temp.award_id('team'), pg_temp.award_id('payment1'))$q$, 'This member is exempt');
reset role;
update public.device_access set revoked_at = now() where auth_user_id = pg_temp.award_id('player');
set local role authenticated;
select pg_temp.award_rejected($q$select public.get_my_unpaid_practices(pg_temp.award_id('team'))$q$, 'Current device');
reset role;
set local role anon;
select pg_temp.award_rejected($q$select public.get_my_unpaid_practices(pg_temp.award_id('team'))$q$, 'permission denied');
reset role;
select 'Personal unpaid history, ownership, old payments, idempotency, exemptions, and Genki tracking passed' as result;
