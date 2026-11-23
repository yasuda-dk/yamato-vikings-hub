-- Former members are eligible nominees; voter and reviewer permissions are unchanged.
create or replace function app_private.get_award_state(target_team_id uuid, target_year integer)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  selected public.club_award_surveys%rowtype;
  member_id uuid := public.current_member_id();
  active boolean;
begin
  if not app_private.is_award_member(target_team_id) then raise exception 'Approved member profile required'; end if;
  select membership_status = 'Active' into active from public.members where id = member_id;
  select * into selected from public.club_award_surveys where team_id = target_team_id and year = target_year;
  return jsonb_build_object(
    'canManage', app_private.is_award_reviewer(target_team_id),
    'years', coalesce((select jsonb_agg(year order by year desc) from public.club_award_surveys where team_id = target_team_id), '[]'::jsonb),
    'survey', case when selected.id is null then null else jsonb_build_object(
      'id', selected.id, 'year', selected.year, 'deadline', selected.deadline,
      'status', case when selected.status = 'Open' and now() < selected.deadline then 'Open' else 'Closed' end,
      'canVote', active and selected.status = 'Open' and now() < selected.deadline
    ) end,
    'candidates', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'first_name', m.first_name, 'membership_status', m.membership_status) order by m.first_name_normalized)
      from public.members m where m.team_id = target_team_id), '[]'::jsonb),
    'ownVotes', coalesce((select jsonb_agg(jsonb_build_object('award', award, 'candidateId', candidate_member_id, 'comment', comment) order by award)
      from public.club_award_votes where survey_id = selected.id and voter_member_id = member_id), '[]'::jsonb)
  );
end;
$$;

create or replace function app_private.save_award_vote(target_team_id uuid, target_survey_id uuid, p_award text, p_candidate_id uuid, p_comment text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  selected public.club_award_surveys%rowtype;
  member_id uuid := public.current_member_id();
begin
  if not app_private.is_award_member(target_team_id) then raise exception 'Approved member profile required'; end if;
  select * into selected from public.club_award_surveys where id = target_survey_id and team_id = target_team_id for update;
  if selected.id is null then raise exception 'Survey not found'; end if;
  if selected.status <> 'Open' or clock_timestamp() >= selected.deadline then raise exception 'Voting is closed'; end if;
  if not exists (select 1 from public.members where id = member_id and team_id = target_team_id and membership_status = 'Active') then
    raise exception 'Active member profile required';
  end if;
  if p_award is null or p_award not in ('MGP', 'MOP') then raise exception 'Award is required'; end if;
  if p_comment is null or char_length(btrim(p_comment)) not between 1 and 1000 then raise exception 'Comment must be between 1 and 1000 characters'; end if;
  if not exists (select 1 from public.members where id = p_candidate_id and team_id = target_team_id) then
    raise exception 'Choose a team member';
  end if;
  insert into public.club_award_votes (survey_id, voter_member_id, award, candidate_member_id, comment)
  values (selected.id, member_id, p_award, p_candidate_id, btrim(p_comment))
  on conflict (survey_id, voter_member_id, award) do update
  set candidate_member_id = excluded.candidate_member_id, comment = excluded.comment, updated_at = clock_timestamp();
end;
$$;
