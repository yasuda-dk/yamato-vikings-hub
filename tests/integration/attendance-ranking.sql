-- Run after annual-awards.sql in the same rollback-only transaction.
reset role;
update public.members set first_name = 'Takashi' where id = pg_temp.award_id('owner_member');
do $$
declare s uuid := gen_random_uuid(); e uuid; i integer; j integer; m uuid;
begin
  insert into public.seasons (id, team_id, name, start_date, end_date)
  values (s, pg_temp.award_id('team'), 'Ranking integration', '2020-01-01', '2099-12-31');
  for i in 1..7 loop
    e := gen_random_uuid();
    insert into public.events (id, team_id, season_id, title, event_type, event_date, start_time, location, rsvp_deadline, status)
    values (e, pg_temp.award_id('team'), s, 'Ranking fixture', 'Social',
      case i when 2 then '2025-01-01'::date when 5 then '2099-01-01'::date else '2026-01-01'::date end,
      '12:00', 'Test pitch', '2025-01-01T10:00:00Z',
      case i when 3 then 'Cancelled'::public.event_status when 4 then 'Draft'::public.event_status else 'Completed'::public.event_status end);
    insert into public.attendance (event_id, member_id, rsvp_status, actual_status)
    values (e, pg_temp.award_id('former_member'), case i when 6 then 'Maybe'::public.rsvp_status when 7 then 'Not going'::public.rsvp_status else 'Going'::public.rsvp_status end,
      case i when 6 then 'Absent'::public.actual_status when 7 then 'Not confirmed'::public.actual_status else 'Attended'::public.actual_status end);
    if i = 1 then
      insert into public.attendance (event_id, member_id, rsvp_status, actual_status)
      values (e, pg_temp.award_id('owner_member'), 'Not going', 'Attended');
      for j in 1..12 loop
        m := gen_random_uuid();
        insert into public.members (id, team_id, first_name, football_level, primary_position)
        values (m, pg_temp.award_id('team'), 'Ranking' || lpad(j::text, 2, '0'), 3, 'MF');
        insert into public.attendance (event_id, member_id, rsvp_status, actual_status) values (e, m, 'Going', 'Attended');
      end loop;
    end if;
  end loop;
end;
$$;
set local role authenticated;
select pg_temp.award_login('owner');
do $$
declare result jsonb;
begin
  result := public.attendance_top_ten(pg_temp.award_id('team'), null);
  perform pg_temp.assert_award(jsonb_array_length(result->'rankings') = 10, 'Ranking exceeds top 10 or lost nominees');
  perform pg_temp.assert_award(result->'rankings'->0->>'first_name' = 'Former' and result->'rankings'->0->>'attended' = '2', 'Incorrect count, period or inactive-member handling');
  perform pg_temp.assert_award(result->'rankings'->1->>'rank' = '2', 'Ties or rank order incorrect');
  result := public.attendance_top_ten(pg_temp.award_id('team'), 2026);
  perform pg_temp.assert_award((select bool_and(r->>'attended' = '1' and r->>'rank' = '1') from jsonb_array_elements(result->'rankings') r), 'RSVP/status/date or tied ranking incorrect');
  perform pg_temp.assert_award(jsonb_array_length(public.attendance_top_ten(pg_temp.award_id('team'), 2024)->'rankings') = 0, 'Empty year incorrect');
end;
$$;
select pg_temp.award_rejected($q$select public.attendance_top_ten(pg_temp.award_id('other_team'), null)$q$, 'Only Takashi');
select pg_temp.award_rejected($q$select public.attendance_top_ten(pg_temp.award_id('team'), 1)$q$, 'Invalid year');
select pg_temp.award_login('admin');
select pg_temp.award_rejected($q$select public.attendance_top_ten(pg_temp.award_id('team'), null)$q$, 'Only Takashi');
select pg_temp.award_login('player');
select pg_temp.award_rejected($q$select public.attendance_top_ten(pg_temp.award_id('team'), 2026)$q$, 'Only Takashi');
select pg_temp.award_login('outsider');
select pg_temp.award_rejected($q$select public.attendance_top_ten(pg_temp.award_id('team'), null)$q$, 'Only Takashi');
reset role;
update public.device_access set revoked_at = now() where auth_user_id = pg_temp.award_id('owner');
set local role authenticated;
select pg_temp.award_login('owner');
select pg_temp.award_rejected($q$select public.attendance_top_ten(pg_temp.award_id('team'), null)$q$, 'Only Takashi');
reset role;
set local role anon;
select pg_temp.award_rejected($q$select public.attendance_top_ten(pg_temp.award_id('team'), null)$q$, 'permission denied');
reset role;
select 'Attendance top 10 counts, years, ties, former members, and private access passed' as result;
