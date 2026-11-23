-- Run with the annual-awards migration inside BEGIN / ROLLBACK.
-- All fixtures are synthetic. No production member or ballot is modified.
create function pg_temp.assert_award(condition boolean, message text) returns void language plpgsql as $$
begin if not coalesce(condition, false) then raise exception '%', message; end if; end;
$$;
create function pg_temp.award_id(name text) returns uuid language sql as $$ select current_setting('test.award_' || name)::uuid; $$;
create function pg_temp.award_login(name text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', pg_temp.award_id(name)::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', pg_temp.award_id(name), 'role', 'authenticated')::text, true);
end;
$$;
create function pg_temp.award_rejected(query text, expected text) returns void language plpgsql as $$
begin
  begin execute query;
  exception when others then
    if sqlerrm not like expected || '%' then raise; end if;
    return;
  end;
  raise exception 'Expected rejection: %', expected;
end;
$$;

do $$
declare
  t uuid := gen_random_uuid(); other_t uuid := gen_random_uuid();
  u uuid; m uuid; person text;
begin
  perform set_config('test.award_team', t::text, true);
  perform set_config('test.award_other_team', other_t::text, true);
  insert into public.teams (id, name) values (t, 'Annual Awards Integration'), (other_t, 'Other Awards Integration');
  insert into public.team_settings (team_id) values (t), (other_t);
  foreach person in array array['owner', 'player', 'admin', 'outsider'] loop
    u := gen_random_uuid(); m := gen_random_uuid();
    perform set_config('test.award_' || person, u::text, true);
    perform set_config('test.award_' || person || '_member', m::text, true);
    insert into auth.users (id, aud, role, is_anonymous) values (u, 'authenticated', 'authenticated', true);
    insert into public.members (id, team_id, first_name, football_level, primary_position, application_role)
    values (m, case when person = 'outsider' then other_t else t end,
      case person when 'owner' then 'Takashi' when 'player' then 'Player' when 'admin' then 'OtherAdmin' else 'Outside' end,
      3, 'MF', case when person in ('owner', 'admin') then 'Admin'::public.application_role else 'Player'::public.application_role end);
    insert into public.device_access (team_id, auth_user_id, access_version) values (case when person = 'outsider' then other_t else t end, u, 1);
    insert into public.member_device_links (member_id, auth_user_id) values (m, u);
  end loop;
  insert into app_private.club_award_reviewers values (t, pg_temp.award_id('owner_member'));
end;
$$;

set local role authenticated;
select pg_temp.award_login('owner');
select set_config('test.award_survey', public.manage_club_award_survey(pg_temp.award_id('team'), 2099, '2099-11-28T18:00', 'Open')::text, true);
select pg_temp.assert_award((select deadline = '2099-11-28T17:00:00Z'::timestamptz from public.club_award_surveys where id = pg_temp.award_id('survey')), 'Copenhagen deadline was shifted');
select public.save_club_award_vote(pg_temp.award_id('team'), pg_temp.award_id('survey'), 'MGP', pg_temp.award_id('owner_member'), 'Owner effort');
select public.save_club_award_vote(pg_temp.award_id('team'), pg_temp.award_id('survey'), 'MOP', pg_temp.award_id('player_member'), 'Owner generosity');

select pg_temp.award_login('player');
select public.save_club_award_vote(pg_temp.award_id('team'), pg_temp.award_id('survey'), 'MGP', pg_temp.award_id('player_member'), 'Self votes allowed');
select public.save_club_award_vote(pg_temp.award_id('team'), pg_temp.award_id('survey'), 'MGP', pg_temp.award_id('owner_member'), 'Updated effort');
select public.save_club_award_vote(pg_temp.award_id('team'), pg_temp.award_id('survey'), 'MOP', pg_temp.award_id('owner_member'), 'Player generosity');
select pg_temp.assert_award((select count(*) = 2 from public.club_award_votes), 'Regular member can read someone else ballot or duplicate votes');
select pg_temp.assert_award(jsonb_array_length(public.club_awards_state(pg_temp.award_id('team'), 2099)->'ownVotes') = 2, 'Own ballots missing');
select pg_temp.assert_award(not (public.club_awards_state(pg_temp.award_id('team'), 2099) ? 'rankings'), 'Rankings leaked through public state');
select pg_temp.award_rejected($q$select public.club_awards_results(pg_temp.award_id('team'), pg_temp.award_id('survey'))$q$, 'Only Takashi');
select pg_temp.award_rejected($q$select public.manage_club_award_survey(pg_temp.award_id('team'), 2099, '2099-11-28T18:00', 'Closed')$q$, 'Only Takashi');
select pg_temp.award_rejected($q$select public.save_club_award_vote(pg_temp.award_id('team'), pg_temp.award_id('survey'), 'MGP', pg_temp.award_id('outsider_member'), 'Wrong team')$q$, 'Choose an active');
select pg_temp.award_rejected($q$select public.save_club_award_vote(pg_temp.award_id('other_team'), pg_temp.award_id('survey'), 'MGP', pg_temp.award_id('player_member'), 'Wrong team')$q$, 'Approved member');
select pg_temp.award_rejected($q$select public.save_club_award_vote(pg_temp.award_id('team'), pg_temp.award_id('survey'), 'MGP', pg_temp.award_id('owner_member'), ' ')$q$, 'Comment must');
select pg_temp.award_rejected($q$insert into public.club_award_votes values (pg_temp.award_id('survey'), pg_temp.award_id('owner_member'), 'MGP', pg_temp.award_id('player_member'), 'Spoofed', now())$q$, 'permission denied');

select pg_temp.award_login('admin');
select pg_temp.assert_award((select count(*) = 0 from public.club_award_votes), 'Another Admin can read private ballots');
select pg_temp.award_rejected($q$select public.club_awards_results(pg_temp.award_id('team'), pg_temp.award_id('survey'))$q$, 'Only Takashi');
select pg_temp.assert_award((public.club_awards_state(pg_temp.award_id('team'), 2099)->>'canManage')::boolean = false, 'Admin was treated as Takashi');

select pg_temp.award_login('owner');
do $$
declare results jsonb;
begin
  results := public.club_awards_results(pg_temp.award_id('team'), pg_temp.award_id('survey'));
  perform pg_temp.assert_award((results->>'responseCount')::int = 2, 'Response count changed');
  perform pg_temp.assert_award(jsonb_array_length(results->'comments') = 4, 'Updated vote was counted twice');
  perform pg_temp.assert_award((select count(*) = 2 from jsonb_array_elements(results->'rankings') r where r->>'award' = 'MOP' and r->>'rank' = '1'), 'Tied votes have different ranks');
  perform pg_temp.assert_award((select count(*) = 1 from jsonb_array_elements(results->'rankings') r where r->>'award' = 'MGP' and r->>'votes' = '2'), 'Ranking totals incorrect');
end;
$$;
select public.manage_club_award_survey(pg_temp.award_id('team'), 2099, '2099-11-28T18:00', 'Closed');
select pg_temp.award_login('player');
select pg_temp.award_rejected($q$select public.save_club_award_vote(pg_temp.award_id('team'), pg_temp.award_id('survey'), 'MOP', pg_temp.award_id('player_member'), 'Late')$q$, 'Voting is closed');

reset role;
update public.club_award_surveys set status = 'Open', deadline = clock_timestamp() - interval '1 second' where id = pg_temp.award_id('survey');
set local role authenticated;
select pg_temp.award_rejected($q$select public.save_club_award_vote(pg_temp.award_id('team'), pg_temp.award_id('survey'), 'MOP', pg_temp.award_id('player_member'), 'Late')$q$, 'Voting is closed');
reset role;
update public.club_award_surveys set deadline = '2099-11-28T17:00:00Z' where id = pg_temp.award_id('survey');
update public.members set membership_status = 'Inactive' where id = pg_temp.award_id('player_member');
set local role authenticated;
select pg_temp.award_rejected($q$select public.save_club_award_vote(pg_temp.award_id('team'), pg_temp.award_id('survey'), 'MOP', pg_temp.award_id('owner_member'), 'Inactive')$q$, 'Active member');
reset role;
update public.device_access set revoked_at = now() where auth_user_id = pg_temp.award_id('player');
set local role authenticated;
select pg_temp.award_rejected($q$select public.club_awards_state(pg_temp.award_id('team'), 2099)$q$, 'Approved member');
select pg_temp.assert_award((select count(*) = 0 from public.club_award_votes), 'Revoked device can read ballots');
reset role;
update public.members set first_name = 'RenamedReviewer' where id = pg_temp.award_id('owner_member');
set local role authenticated;
select pg_temp.award_login('admin');
select pg_temp.award_rejected($q$select public.select_member_profile(pg_temp.award_id('owner_member'))$q$, 'This profile cannot be selected');
reset role;
set local role anon;
select pg_temp.award_rejected($q$select public.club_awards_results(pg_temp.award_id('team'), pg_temp.award_id('survey'))$q$, 'permission denied');
select pg_temp.award_rejected($q$select count(*) from public.club_award_votes$q$, 'permission denied');
reset role;
select 'Annual awards privacy, RLS, voting, ties, self-voting, deadlines, and isolation passed' as result;
