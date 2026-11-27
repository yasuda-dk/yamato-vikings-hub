create function app_private.get_my_unpaid_practices(target_team_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  active_member_id uuid := public.current_member_id();
  selected public.members%rowtype;
begin
  if auth.uid() is null or not public.has_current_device_access(target_team_id) then
    raise exception 'Current device is not approved';
  end if;
  select * into selected from public.members where id = active_member_id and team_id = target_team_id;
  if selected.id is null then raise exception 'No active member profile selected'; end if;
  if selected.practice_payment_rule = 'Exempt' or public.practice_payment_amount(selected) <= 0 then return '[]'::jsonb; end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
    'id', e.id, 'title', e.title, 'event_date', e.event_date, 'start_time', e.start_time,
    'location', e.location, 'pitch_type', e.pitch_type, 'payment_deadline_date', e.event_date + 1,
    'amount_dkk', public.practice_payment_amount(selected)
  ) order by e.event_date, e.start_time, e.id)
  from public.events e
  join public.attendance a on a.event_id = e.id and a.member_id = selected.id and a.rsvp_status = 'Going'
  where e.team_id = target_team_id and e.title ilike 'Practice%' and e.event_type = 'Football'
    and e.status not in ('Draft', 'Cancelled')
    and e.event_date <= (now() at time zone 'Europe/Copenhagen')::date
    and not exists (select 1 from public.practice_payments p where p.event_id = e.id and p.member_id = selected.id)
  ), '[]'::jsonb);
end;
$$;

create function public.get_my_unpaid_practices(target_team_id uuid)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select app_private.get_my_unpaid_practices(target_team_id);
$$;
revoke all on function app_private.get_my_unpaid_practices(uuid), public.get_my_unpaid_practices(uuid) from public, anon;
grant execute on function app_private.get_my_unpaid_practices(uuid), public.get_my_unpaid_practices(uuid) to authenticated;

-- Keep the existing member-only reporting workflow, including historical events.
create or replace function public.mark_practice_payment_paid(target_team_id uuid, target_event_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  active_member_id uuid := public.current_member_id();
  selected public.members%rowtype;
  target_event public.events%rowtype;
  amount integer;
begin
  if auth.uid() is null or not public.has_current_device_access(target_team_id) then raise exception 'Current device is not approved'; end if;
  select * into selected from public.members where id = active_member_id and team_id = target_team_id and membership_status = 'Active';
  if selected.id is null then raise exception 'No active member profile selected'; end if;
  if selected.practice_payment_rule = 'Exempt' then raise exception 'This member is exempt from Practice payment.'; end if;
  select * into target_event from public.events where id = target_event_id and team_id = target_team_id
    and title ilike 'Practice%' and event_type = 'Football' and status <> 'Cancelled';
  if target_event.id is null then raise exception 'Practice event not found'; end if;
  if not exists (select 1 from public.attendance a where a.event_id = target_event_id and a.member_id = selected.id and a.rsvp_status = 'Going') then
    raise exception 'Only Going members can mark practice payment paid.';
  end if;
  amount := public.practice_payment_amount(selected);
  if amount <= 0 then raise exception 'Practice payment amount must be above 0 DKK.'; end if;
  insert into public.practice_payments (team_id, event_id, member_id, amount_dkk, paid_at)
  values (target_team_id, target_event_id, selected.id, amount, now())
  on conflict (event_id, member_id) do nothing;
  return public.get_practice_payment_state(target_team_id);
end;
$$;
