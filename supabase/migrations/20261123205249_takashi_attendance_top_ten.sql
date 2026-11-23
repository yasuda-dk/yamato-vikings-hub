-- Reuse the pinned Takashi identity, not an editable name or an Admin role.
create function app_private.attendance_top_ten(target_team_id uuid, target_year integer)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not app_private.is_award_reviewer(target_team_id) then raise exception 'Only Takashi can view attendance rankings'; end if;
  if target_year is not null and target_year not between 2020 and 2200 then raise exception 'Invalid year'; end if;
  return jsonb_build_object(
    'years', coalesce((select jsonb_agg(y order by y desc) from (
      select distinct extract(year from e.event_date)::integer y from public.events e
      where e.team_id = target_team_id and e.status not in ('Draft', 'Cancelled')
        and e.event_date <= (now() at time zone 'Europe/Copenhagen')::date
    ) years), '[]'::jsonb),
    'rankings', coalesce((select jsonb_agg(to_jsonb(r) order by r.attended desc, r.first_name, r."memberId") from (
      select m.id as "memberId", m.first_name, m.membership_status, count(distinct e.id) as attended,
        rank() over (order by count(distinct e.id) desc) as rank
      from public.attendance a
      join public.events e on e.id = a.event_id
      join public.members m on m.id = a.member_id and m.team_id = e.team_id
      where e.team_id = target_team_id and e.status not in ('Draft', 'Cancelled')
        and e.event_date <= (now() at time zone 'Europe/Copenhagen')::date
        and (target_year is null or (e.event_date >= make_date(target_year, 1, 1) and e.event_date < make_date(target_year + 1, 1, 1)))
        and a.rsvp_status = 'Going'
      group by m.id, m.first_name, m.membership_status
      order by attended desc, m.first_name, m.id limit 10
    ) r), '[]'::jsonb)
  );
end;
$$;

create function public.attendance_top_ten(target_team_id uuid, target_year integer)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select app_private.attendance_top_ten(target_team_id, target_year);
$$;
revoke all on function app_private.attendance_top_ten(uuid, integer), public.attendance_top_ten(uuid, integer) from public, anon;
grant execute on function app_private.attendance_top_ten(uuid, integer), public.attendance_top_ten(uuid, integer) to authenticated;
