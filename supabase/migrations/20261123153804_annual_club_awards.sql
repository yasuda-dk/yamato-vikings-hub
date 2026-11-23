create schema if not exists app_private;
revoke all on schema app_private from public, anon;
grant usage on schema app_private to authenticated;

-- Bind the reviewer to the existing protected profile, not to the Admin role.
create table app_private.club_award_reviewers (
  team_id uuid primary key references public.teams(id) on delete restrict,
  member_id uuid not null references public.members(id) on delete restrict
);
alter table app_private.club_award_reviewers enable row level security;
create index club_award_reviewers_member_idx on app_private.club_award_reviewers(member_id);
revoke all on app_private.club_award_reviewers from public, anon, authenticated;
insert into app_private.club_award_reviewers (team_id, member_id)
select team_id, id from public.members where first_name_normalized = 'takashi';

create table public.club_award_surveys (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete restrict,
  year integer not null check (year between 2020 and 2200),
  deadline timestamptz not null,
  status text not null check (status in ('Open', 'Closed')),
  created_by uuid not null references public.members(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (team_id, year)
);
create table public.club_award_votes (
  survey_id uuid not null references public.club_award_surveys(id) on delete restrict,
  voter_member_id uuid not null references public.members(id) on delete restrict,
  award text not null check (award in ('MGP', 'MOP')),
  candidate_member_id uuid not null references public.members(id) on delete restrict,
  comment text not null check (char_length(btrim(comment)) between 1 and 1000),
  updated_at timestamptz not null default now(),
  primary key (survey_id, voter_member_id, award)
);
create index club_award_votes_candidate_idx on public.club_award_votes(candidate_member_id);
create index club_award_surveys_creator_idx on public.club_award_surveys(created_by);
create index club_award_votes_voter_idx on public.club_award_votes(voter_member_id);
alter table public.club_award_surveys enable row level security;
alter table public.club_award_votes enable row level security;
revoke all on public.club_award_surveys, public.club_award_votes from public, anon, authenticated;
grant select on public.club_award_surveys, public.club_award_votes to authenticated;

create function app_private.is_award_member(target_team_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null
    and public.has_current_device_access(target_team_id)
    and exists (select 1 from public.members where id = public.current_member_id() and team_id = target_team_id);
$$;
create function app_private.is_award_reviewer(target_team_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select app_private.is_award_member(target_team_id) and exists (
    select 1 from app_private.club_award_reviewers r
    join public.members m on m.id = r.member_id and m.team_id = r.team_id
    where r.team_id = target_team_id and r.member_id = public.current_member_id()
      and m.first_name_normalized = 'takashi' and m.membership_status = 'Active'
  );
$$;
revoke all on function app_private.is_award_member(uuid), app_private.is_award_reviewer(uuid) from public, anon;
grant execute on function app_private.is_award_member(uuid), app_private.is_award_reviewer(uuid) to authenticated;

create policy "Approved profiles read annual surveys" on public.club_award_surveys
for select to authenticated using (app_private.is_award_member(team_id));
create policy "Own ballots or Takashi review only" on public.club_award_votes
for select to authenticated using (exists (
  select 1 from public.club_award_surveys s where s.id = survey_id
    and app_private.is_award_member(s.team_id)
    and (voter_member_id = public.current_member_id() or app_private.is_award_reviewer(s.team_id))
));

create function app_private.get_award_state(target_team_id uuid, target_year integer)
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
      from public.members m where m.team_id = target_team_id and (m.membership_status = 'Active' or exists (
        select 1 from public.club_award_votes v where v.survey_id = selected.id and v.voter_member_id = member_id and v.candidate_member_id = m.id
      ))), '[]'::jsonb),
    'ownVotes', coalesce((select jsonb_agg(jsonb_build_object('award', award, 'candidateId', candidate_member_id, 'comment', comment) order by award)
      from public.club_award_votes where survey_id = selected.id and voter_member_id = member_id), '[]'::jsonb)
  );
end;
$$;

create function app_private.save_award_vote(target_team_id uuid, target_survey_id uuid, p_award text, p_candidate_id uuid, p_comment text)
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
  if not exists (select 1 from public.members where id = p_candidate_id and team_id = target_team_id and membership_status = 'Active') then
    raise exception 'Choose an active team member';
  end if;
  insert into public.club_award_votes (survey_id, voter_member_id, award, candidate_member_id, comment)
  values (selected.id, member_id, p_award, p_candidate_id, btrim(p_comment))
  on conflict (survey_id, voter_member_id, award) do update
  set candidate_member_id = excluded.candidate_member_id, comment = excluded.comment, updated_at = clock_timestamp();
end;
$$;

create function app_private.manage_award_survey(target_team_id uuid, target_year integer, p_deadline_local text, p_status text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  cutoff timestamptz;
  survey_id uuid;
begin
  if not app_private.is_award_reviewer(target_team_id) then raise exception 'Only Takashi can manage annual awards'; end if;
  if target_year is null or target_year not between 2020 and 2200 then raise exception 'Invalid award year'; end if;
  if p_status is null or p_status not in ('Open', 'Closed') then raise exception 'Invalid survey status'; end if;
  if p_deadline_local is null or p_deadline_local !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$' then raise exception 'Deadline is required'; end if;
  cutoff := p_deadline_local::timestamp at time zone 'Europe/Copenhagen';
  if extract(year from cutoff at time zone 'Europe/Copenhagen') <> target_year then raise exception 'Deadline must be in the award year'; end if;
  if p_status = 'Open' and cutoff <= clock_timestamp() then raise exception 'Open surveys need a future deadline'; end if;
  insert into public.club_award_surveys (team_id, year, deadline, status, created_by)
  values (target_team_id, target_year, cutoff, p_status, public.current_member_id())
  on conflict (team_id, year) do update set deadline = excluded.deadline, status = excluded.status returning id into survey_id;
  return survey_id;
end;
$$;

create function app_private.get_award_results(target_team_id uuid, target_survey_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not app_private.is_award_reviewer(target_team_id) then raise exception 'Only Takashi can view annual award results'; end if;
  if not exists (select 1 from public.club_award_surveys where id = target_survey_id and team_id = target_team_id) then raise exception 'Survey not found'; end if;
  return jsonb_build_object(
    'responseCount', (select count(distinct voter_member_id) from public.club_award_votes where survey_id = target_survey_id),
    'rankings', coalesce((select jsonb_agg(to_jsonb(r) order by r.award, r.rank, r.first_name) from (
      select v.award, v.candidate_member_id as "candidateId", m.first_name, count(*) as votes,
        rank() over (partition by v.award order by count(*) desc) as rank
      from public.club_award_votes v join public.members m on m.id = v.candidate_member_id
      where v.survey_id = target_survey_id group by v.award, v.candidate_member_id, m.first_name
    ) r), '[]'::jsonb),
    'comments', coalesce((select jsonb_agg(jsonb_build_object('award', v.award, 'candidateId', v.candidate_member_id,
      'voter', m.first_name, 'comment', v.comment, 'updatedAt', v.updated_at) order by v.updated_at desc)
      from public.club_award_votes v join public.members m on m.id = v.voter_member_id
      where v.survey_id = target_survey_id), '[]'::jsonb)
  );
end;
$$;

create function public.club_awards_state(target_team_id uuid, target_year integer)
returns jsonb language sql stable security invoker set search_path = '' as $$ select app_private.get_award_state(target_team_id, target_year); $$;
create function public.save_club_award_vote(target_team_id uuid, target_survey_id uuid, p_award text, p_candidate_id uuid, p_comment text)
returns void language sql security invoker set search_path = '' as $$ select app_private.save_award_vote(target_team_id, target_survey_id, p_award, p_candidate_id, p_comment); $$;
create function public.manage_club_award_survey(target_team_id uuid, target_year integer, p_deadline_local text, p_status text)
returns uuid language sql security invoker set search_path = '' as $$ select app_private.manage_award_survey(target_team_id, target_year, p_deadline_local, p_status); $$;
create function public.club_awards_results(target_team_id uuid, target_survey_id uuid)
returns jsonb language sql stable security invoker set search_path = '' as $$ select app_private.get_award_results(target_team_id, target_survey_id); $$;

revoke all on function app_private.get_award_state(uuid, integer), app_private.save_award_vote(uuid, uuid, text, uuid, text), app_private.manage_award_survey(uuid, integer, text, text), app_private.get_award_results(uuid, uuid) from public, anon;
grant execute on function app_private.get_award_state(uuid, integer), app_private.save_award_vote(uuid, uuid, text, uuid, text), app_private.manage_award_survey(uuid, integer, text, text), app_private.get_award_results(uuid, uuid) to authenticated;
revoke all on function public.club_awards_state(uuid, integer), public.save_club_award_vote(uuid, uuid, text, uuid, text), public.manage_club_award_survey(uuid, integer, text, text), public.club_awards_results(uuid, uuid) from public, anon;
grant execute on function public.club_awards_state(uuid, integer), public.save_club_award_vote(uuid, uuid, text, uuid, text), public.manage_club_award_survey(uuid, integer, text, text), public.club_awards_results(uuid, uuid) to authenticated;

-- Keep the protected reviewer profile unselectable even if an Admin renames it.
create or replace function public.select_member_profile(target_member_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  member_team_id uuid;
  target_member public.members%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required';
  end if;

  select * into target_member
  from public.members
  where id = target_member_id;

  if target_member.id is null then
    raise exception 'Member not found';
  end if;

  member_team_id := target_member.team_id;

  if not public.has_current_device_access(member_team_id) then
    raise exception 'Current device is not approved';
  end if;

  if (target_member.first_name_normalized = 'takashi' or exists (
      select 1 from app_private.club_award_reviewers where member_id = target_member_id
    ))
    and public.current_member_id() is distinct from target_member_id then
    raise exception 'This profile cannot be selected from this device.';
  end if;

  update public.member_device_links
  set unlinked_at = now()
  where auth_user_id = auth.uid()
    and unlinked_at is null;

  insert into public.member_device_links (member_id, auth_user_id)
  values (target_member_id, auth.uid());

  return target_member_id;
end;
$$;
