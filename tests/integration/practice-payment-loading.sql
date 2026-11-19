-- Run as the database owner in a transaction. No records are changed.
-- Select existing approved profiles dynamically; never store production fixtures.
do $$
declare
  device record;
  full_state jsonb;
  current_state jsonb;
  history_state jsonb;
  checked integer := 0;
begin
  if has_function_privilege('anon', 'public.get_practice_payment_state(uuid,boolean)', 'execute')
    or has_function_privilege('anon', 'public.get_practice_payment_history(uuid)', 'execute') then
    raise exception 'New payment RPCs must not be executable by anon';
  end if;

  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '{}', true);
  begin
    perform public.get_practice_payment_state('00000000-0000-0000-0000-000000000000', false);
    raise exception 'Unauthenticated current payment request was accepted';
  exception when raise_exception then
    if sqlerrm <> 'Current device is not approved' then raise; end if;
  end;
  begin
    perform public.get_practice_payment_history('00000000-0000-0000-0000-000000000000');
    raise exception 'Unauthenticated history request was accepted';
  exception when raise_exception then
    if sqlerrm <> 'Current device is not approved' then raise; end if;
  end;

  for device in
    select distinct da.auth_user_id, da.team_id
    from public.device_access da
    join public.team_settings ts on ts.team_id = da.team_id and ts.access_version = da.access_version
    join public.member_device_links mdl on mdl.auth_user_id = da.auth_user_id and mdl.unlinked_at is null
    where da.revoked_at is null
  loop
    perform set_config('request.jwt.claim.sub', device.auth_user_id::text, true);
    perform set_config('request.jwt.claims', jsonb_build_object('sub', device.auth_user_id, 'role', 'authenticated')::text, true);
    if public.current_member_id() is null then continue; end if;

    full_state := public.get_practice_payment_state(device.team_id);
    current_state := public.get_practice_payment_state(device.team_id, false);
    history_state := public.get_practice_payment_history(device.team_id);
    if current_state->'practiceHistory' <> '[]'::jsonb then
      raise exception 'Current request calculated historical payment data';
    end if;
    if (current_state - 'practiceHistory' - 'canTrackPayments') <> (full_state - 'practiceHistory' - 'canTrackPayments') then
      raise exception 'Current payments or totals changed';
    end if;
    if history_state <> full_state->'practiceHistory' then
      raise exception 'History totals or pitch values changed';
    end if;
    if (current_state->>'canTrackPayments')::boolean <> public.can_view_practice_payment_tracking(device.team_id) then
      raise exception 'Tracking permission changed';
    end if;
    if not public.can_view_practice_payment_tracking(device.team_id) and history_state <> '[]'::jsonb then
      raise exception 'Regular profile can read tracking history';
    end if;
    begin
      perform public.get_practice_payment_history('00000000-0000-0000-0000-000000000000');
      raise exception 'Cross-team history request was accepted';
    exception when raise_exception then
      if sqlerrm <> 'Current device is not approved' then raise; end if;
    end;
    checked := checked + 1;
  end loop;
  if checked = 0 then raise exception 'No approved selected profiles available for integration checks'; end if;
end;
$$;

select 'Payment permission, current/history parity, and cross-team checks passed' as result;
