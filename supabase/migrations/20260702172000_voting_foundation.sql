do $$
begin
  if not exists (select 1 from pg_type where typname = 'vote_type' and typnamespace = 'public'::regnamespace) then
    create type public.vote_type as enum ('MVP', 'Worst');
  end if;
end $$;

create table public.votes (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  voter_member_id uuid not null references public.members(id) on delete restrict,
  candidate_member_id uuid references public.members(id) on delete restrict,
  candidate_event_guest_id uuid references public.event_guests(id) on delete restrict,
  vote_type public.vote_type not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint votes_exactly_one_candidate check (
    (candidate_member_id is not null and candidate_event_guest_id is null)
    or (candidate_member_id is null and candidate_event_guest_id is not null)
  ),
  constraint votes_one_per_type unique (event_id, voter_member_id, vote_type)
);

create table public.event_awards (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  member_id uuid references public.members(id) on delete restrict,
  event_guest_id uuid references public.event_guests(id) on delete restrict,
  award_type public.vote_type not null,
  vote_count integer not null default 0,
  is_admin_override boolean not null default false,
  created_at timestamptz not null default now(),
  constraint event_awards_exactly_one_candidate check (
    (member_id is not null and event_guest_id is null)
    or (member_id is null and event_guest_id is not null)
  )
);

create index votes_event_id_idx on public.votes(event_id);
create index event_awards_event_id_idx on public.event_awards(event_id);

alter table public.votes enable row level security;
alter table public.event_awards enable row level security;

create policy "Members can read their own votes"
on public.votes
for select
using (voter_member_id = public.current_member_id());

create policy "Approved devices can read completed awards"
on public.event_awards
for select
using (
  exists (
    select 1
    from public.events e
    where e.id = event_awards.event_id
      and e.status = 'Completed'
      and public.has_current_device_access(e.team_id)
  )
);

create or replace function public.get_event_voting(target_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_event record;
  current_member uuid;
  eligible boolean;
  candidates jsonb;
  own_votes jsonb;
  final_results jsonb;
begin
  select * into target_event
  from public.events
  where id = target_event_id;

  if target_event.id is null then
    raise exception 'Event not found';
  end if;

  if not public.has_current_device_access(target_event.team_id) then
    raise exception 'Current device is not approved';
  end if;

  current_member := public.current_member_id();

  select exists (
    select 1
    from public.attendance a
    join public.members m on m.id = a.member_id
    where a.event_id = target_event_id
      and a.member_id = current_member
      and a.actual_status = 'Attended'
      and m.membership_status = 'Active'
      and target_event.status = 'Voting open'
      and target_event.enable_voting = true
  ) into eligible;

  with candidate_rows as (
    select 'member' as kind, m.id, m.first_name
    from public.attendance a
    join public.members m on m.id = a.member_id
    where a.event_id = target_event_id
      and a.actual_status = 'Attended'
      and m.membership_status = 'Active'
    union all
    select 'guest' as kind, guest.id, guest.first_name
    from public.event_guests guest
    where guest.event_id = target_event_id
      and guest.actual_status = 'Attended'
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'kind', kind,
        'id', id,
        'first_name', first_name
      )
      order by first_name
    ),
    '[]'::jsonb
  ) into candidates
  from candidate_rows;

  select coalesce(
    jsonb_object_agg(
      v.vote_type::text,
      jsonb_build_object(
        'candidateKind', case when v.candidate_member_id is not null then 'member' else 'guest' end,
        'candidateId', coalesce(v.candidate_member_id, v.candidate_event_guest_id)
      )
    ),
    '{}'::jsonb
  ) into own_votes
  from public.votes v
  where v.event_id = target_event_id
    and v.voter_member_id = current_member;

  if target_event.status = 'Completed' then
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'vote_type', award.award_type,
          'kind', case when award.member_id is not null then 'member' else 'guest' end,
          'id', coalesce(award.member_id, award.event_guest_id),
          'first_name', coalesce(m.first_name, guest.first_name),
          'vote_count', award.vote_count,
          'is_winner', true
        )
        order by award.award_type, coalesce(m.first_name, guest.first_name)
      ),
      '[]'::jsonb
    ) into final_results
    from public.event_awards award
    left join public.members m on m.id = award.member_id
    left join public.event_guests guest on guest.id = award.event_guest_id
    where award.event_id = target_event_id;
  else
    final_results := '[]'::jsonb;
  end if;

  return jsonb_build_object(
    'eventId', target_event_id,
    'status', target_event.status,
    'enableVoting', target_event.enable_voting,
    'isEligibleVoter', eligible,
    'candidates', candidates,
    'myVotes', own_votes,
    'results', final_results
  );
end;
$$;

create or replace function public.submit_event_vote(
  target_event_id uuid,
  p_vote_type public.vote_type,
  p_candidate_member_id uuid default null,
  p_candidate_event_guest_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_event record;
  voter uuid;
begin
  select * into target_event
  from public.events
  where id = target_event_id;

  if target_event.id is null then
    raise exception 'Event not found';
  end if;

  if target_event.enable_voting is not true then
    raise exception 'Voting is disabled for this event';
  end if;

  if target_event.status <> 'Voting open' then
    raise exception 'Voting is not open';
  end if;

  voter := public.current_member_id();

  if voter is null then
    raise exception 'Select a member profile before voting';
  end if;

  if not exists (
    select 1
    from public.attendance a
    join public.members m on m.id = a.member_id
    where a.event_id = target_event_id
      and a.member_id = voter
      and a.actual_status = 'Attended'
      and m.membership_status = 'Active'
  ) then
    raise exception 'Only attended active members can vote';
  end if;

  if (p_candidate_member_id is null and p_candidate_event_guest_id is null)
    or (p_candidate_member_id is not null and p_candidate_event_guest_id is not null) then
    raise exception 'Choose one candidate';
  end if;

  if p_candidate_member_id = voter then
    raise exception 'You cannot vote for yourself';
  end if;

  if p_candidate_member_id is not null and not exists (
    select 1
    from public.attendance a
    join public.members m on m.id = a.member_id
    where a.event_id = target_event_id
      and a.member_id = p_candidate_member_id
      and a.actual_status = 'Attended'
      and m.membership_status = 'Active'
  ) then
    raise exception 'Candidate is not eligible';
  end if;

  if p_candidate_event_guest_id is not null and not exists (
    select 1
    from public.event_guests guest
    where guest.event_id = target_event_id
      and guest.id = p_candidate_event_guest_id
      and guest.actual_status = 'Attended'
  ) then
    raise exception 'Candidate is not eligible';
  end if;

  insert into public.votes (
    event_id,
    voter_member_id,
    vote_type,
    candidate_member_id,
    candidate_event_guest_id
  )
  values (
    target_event_id,
    voter,
    p_vote_type,
    p_candidate_member_id,
    p_candidate_event_guest_id
  )
  on conflict (event_id, voter_member_id, vote_type)
  do update set
    candidate_member_id = excluded.candidate_member_id,
    candidate_event_guest_id = excluded.candidate_event_guest_id,
    updated_at = now();

  return public.get_event_voting(target_event_id);
end;
$$;

create or replace function public.set_event_voting_status(
  target_event_id uuid,
  p_status public.event_status
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_event record;
begin
  select * into target_event
  from public.events
  where id = target_event_id;

  if target_event.id is null then
    raise exception 'Event not found';
  end if;

  if not public.is_admin(target_event.team_id) then
    raise exception 'Admin permission is required';
  end if;

  if target_event.enable_voting is not true then
    raise exception 'Voting is disabled for this event';
  end if;

  if p_status not in ('Voting open', 'Completed') then
    raise exception 'Unsupported voting status';
  end if;

  if p_status = 'Voting open' then
    if target_event.status in ('Cancelled', 'Completed') then
      raise exception 'Voting cannot be opened for this event status';
    end if;

    if not exists (
      select 1
      from public.attendance a
      join public.members m on m.id = a.member_id
      where a.event_id = target_event_id
        and a.actual_status = 'Attended'
        and m.membership_status = 'Active'
      union all
      select 1
      from public.event_guests guest
      where guest.event_id = target_event_id
        and guest.actual_status = 'Attended'
      limit 1
    ) then
      raise exception 'Confirm attendance before opening voting';
    end if;

    update public.events
    set status = 'Voting open'
    where id = target_event_id;

    delete from public.event_awards
    where event_id = target_event_id
      and is_admin_override = false;

    return public.get_event_voting(target_event_id);
  end if;

  if target_event.status <> 'Voting open' then
    raise exception 'Voting must be open before it can be closed';
  end if;

  delete from public.event_awards
  where event_id = target_event_id
    and is_admin_override = false;

  with vote_totals as (
    select
      v.vote_type,
      v.candidate_member_id,
      v.candidate_event_guest_id,
      count(*)::integer as vote_count
    from public.votes v
    where v.event_id = target_event_id
    group by v.vote_type, v.candidate_member_id, v.candidate_event_guest_id
  ),
  winners as (
    select *
    from vote_totals totals
    where totals.vote_count = (
      select max(compare_totals.vote_count)
      from vote_totals compare_totals
      where compare_totals.vote_type = totals.vote_type
    )
      and totals.vote_count > 0
  )
  insert into public.event_awards (
    event_id,
    member_id,
    event_guest_id,
    award_type,
    vote_count,
    is_admin_override
  )
  select
    target_event_id,
    candidate_member_id,
    candidate_event_guest_id,
    vote_type,
    vote_count,
    false
  from winners;

  update public.events
  set status = 'Completed'
  where id = target_event_id;

  return public.get_event_voting(target_event_id);
end;
$$;

grant execute on function public.get_event_voting(uuid) to authenticated;
grant execute on function public.submit_event_vote(uuid, public.vote_type, uuid, uuid) to authenticated;
grant execute on function public.set_event_voting_status(uuid, public.event_status) to authenticated;
