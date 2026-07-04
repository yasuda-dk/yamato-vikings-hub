create or replace function public.list_events(target_team_id uuid)
returns table (
  id uuid,
  title text,
  event_type public.event_type,
  event_date date,
  start_time time,
  location text,
  rsvp_deadline timestamptz,
  status public.event_status,
  my_rsvp_status public.rsvp_status,
  going_count bigint,
  maybe_count bigint,
  not_going_count bigint,
  late_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    e.id,
    e.title,
    e.event_type,
    e.event_date,
    e.start_time,
    e.location,
    e.rsvp_deadline,
    e.status,
    my_attendance.rsvp_status as my_rsvp_status,
    count(a.id) filter (where a.rsvp_status = 'Going') as going_count,
    count(a.id) filter (where a.rsvp_status = 'Maybe') as maybe_count,
    count(a.id) filter (where a.rsvp_status = 'Not going') as not_going_count,
    count(a.id) filter (where a.rsvp_status = 'Going' and a.is_arriving_late) as late_count
  from public.events e
  left join public.attendance a on a.event_id = e.id
  left join public.attendance my_attendance
    on my_attendance.event_id = e.id
    and my_attendance.member_id = public.current_member_id()
  where e.team_id = target_team_id
    and e.event_date >= (now() at time zone 'Europe/Copenhagen')::date
    and public.has_current_device_access(target_team_id)
  group by e.id, my_attendance.rsvp_status
  order by e.event_date asc, e.start_time asc;
$$;
