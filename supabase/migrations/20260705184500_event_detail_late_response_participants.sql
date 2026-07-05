create or replace function public.get_event_detail(target_event_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'event', to_jsonb(e),
    'myRsvp', (
      select to_jsonb(a)
      from public.attendance a
      where a.event_id = e.id
        and a.member_id = public.current_member_id()
      limit 1
    ),
    'counts', jsonb_build_object(
      'going', coalesce((select count(*) from public.attendance a where a.event_id = e.id and a.rsvp_status = 'Going'), 0),
      'maybe', coalesce((select count(*) from public.attendance a where a.event_id = e.id and a.rsvp_status = 'Maybe'), 0),
      'notGoing', coalesce((select count(*) from public.attendance a where a.event_id = e.id and a.rsvp_status = 'Not going'), 0),
      'noResponse', coalesce((
        select count(*)
        from public.members m
        left join public.attendance a
          on a.event_id = e.id
          and a.member_id = m.id
        where m.team_id = e.team_id
          and m.membership_status = 'Active'
          and a.id is null
      ), 0),
      'late', coalesce((select count(*) from public.attendance a where a.event_id = e.id and a.rsvp_status = 'Going' and a.is_arriving_late), 0),
      'attended', coalesce((select count(*) from public.attendance a where a.event_id = e.id and a.actual_status = 'Attended'), 0)
        + coalesce((select count(*) from public.event_guests guest where guest.event_id = e.id and guest.actual_status = 'Attended'), 0),
      'guests', coalesce((select count(*) from public.event_guests guest where guest.event_id = e.id), 0)
    ),
    'participants', coalesce((
      select jsonb_agg(participant order by participant->>'sortName')
      from (
        select jsonb_build_object(
          'kind', 'member',
          'id', m.id,
          'first_name', m.first_name,
          'rsvp_status', a.rsvp_status,
          'is_arriving_late', coalesce(a.is_arriving_late, false),
          'expected_arrival_time', a.expected_arrival_time,
          'was_updated_after_deadline', coalesce(a.was_updated_after_deadline, false),
          'actual_status', coalesce(a.actual_status, 'Not confirmed'::public.actual_status),
          'football_level', m.football_level,
          'primary_position', m.primary_position,
          'secondary_position', m.secondary_position,
          'age_group', m.age_group,
          'sortName', m.first_name_normalized
        ) as participant
        from public.members m
        left join public.attendance a
          on a.event_id = e.id
          and a.member_id = m.id
        where m.team_id = e.team_id
          and m.membership_status = 'Active'
        union all
        select jsonb_build_object(
          'kind', 'guest',
          'id', guest.id,
          'first_name', guest.first_name,
          'rsvp_status', null,
          'is_arriving_late', false,
          'expected_arrival_time', null,
          'was_updated_after_deadline', false,
          'actual_status', guest.actual_status,
          'football_level', guest.football_level,
          'primary_position', guest.primary_position,
          'secondary_position', guest.secondary_position,
          'age_group', guest.age_group,
          'sortName', guest.first_name_normalized
        ) as participant
        from public.event_guests guest
        where guest.event_id = e.id
      ) participants
    ), '[]'::jsonb),
    'guests', coalesce((
      select jsonb_agg(to_jsonb(guest) order by guest.first_name_normalized)
      from public.event_guests guest
      where guest.event_id = e.id
    ), '[]'::jsonb)
  )
  from public.events e
  where e.id = target_event_id
    and public.has_current_device_access(e.team_id);
$$;
