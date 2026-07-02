create or replace function public.list_fine_box(target_team_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  settings jsonb;
  summary jsonb;
  fine_rows jsonb;
  participant_rows jsonb;
begin
  if not public.has_current_device_access(target_team_id) then
    raise exception 'Current device is not approved';
  end if;

  select jsonb_build_object(
    'mobilepay_box_number', ts.mobilepay_box_number,
    'mobilepay_url', ts.mobilepay_url,
    'payment_instructions', ts.payment_instructions
  )
  into settings
  from public.team_settings ts
  where ts.team_id = target_team_id;

  select jsonb_build_object(
    'unpaid_total_dkk', coalesce(sum(amount_dkk) filter (where payment_status = 'Unpaid'), 0),
    'payment_reported_total_dkk', coalesce(sum(amount_dkk) filter (where payment_status = 'Payment reported'), 0),
    'paid_total_dkk', coalesce(sum(amount_dkk) filter (where payment_status = 'Paid'), 0),
    'waived_total_dkk', coalesce(sum(amount_dkk) filter (where payment_status = 'Waived'), 0)
  )
  into summary
  from public.fines
  where team_id = target_team_id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', f.id,
        'participant_kind', case when f.member_id is not null then 'member' else 'guest' end,
        'participant_id', coalesce(f.member_id, f.event_guest_id),
        'first_name', coalesce(m.first_name, guest.first_name),
        'fine_type_name', ft.name,
        'description', f.description,
        'amount_dkk', f.amount_dkk,
        'payment_status', f.payment_status,
        'related_event_title', e.title,
        'related_event_date', e.event_date,
        'created_at', f.created_at,
        'payment_reported_at', f.payment_reported_at,
        'payment_confirmed_at', f.payment_confirmed_at,
        'waived_at', f.waived_at
      )
      order by
        case f.payment_status
          when 'Unpaid' then 1
          when 'Payment reported' then 2
          when 'Paid' then 3
          when 'Waived' then 4
        end,
        coalesce(m.first_name, guest.first_name),
        f.created_at desc
    ),
    '[]'::jsonb
  )
  into fine_rows
  from public.fines f
  left join public.members m on m.id = f.member_id
  left join public.event_guests guest on guest.id = f.event_guest_id
  left join public.fine_types ft on ft.id = f.fine_type_id
  left join public.events e on e.id = f.event_id
  where f.team_id = target_team_id;

  with participant_options as (
    select
      'member' as kind,
      m.id,
      m.first_name,
      null::text as context
    from public.members m
    where m.team_id = target_team_id
      and m.membership_status = 'Active'
    union all
    select
      'guest' as kind,
      guest.id,
      guest.first_name,
      e.title as context
    from public.event_guests guest
    join public.events e on e.id = guest.event_id
    where e.team_id = target_team_id
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'kind', kind,
        'id', id,
        'first_name', first_name,
        'context', context
      )
      order by kind desc, first_name, context
    ),
    '[]'::jsonb
  )
  into participant_rows
  from participant_options;

  return jsonb_build_object(
    'settings', coalesce(settings, '{}'::jsonb),
    'summary', coalesce(summary, jsonb_build_object('unpaid_total_dkk', 0, 'payment_reported_total_dkk', 0, 'paid_total_dkk', 0, 'waived_total_dkk', 0)),
    'fines', fine_rows,
    'participants', participant_rows
  );
end;
$$;

create or replace function public.create_fine(
  target_team_id uuid,
  p_participant_kind text,
  p_participant_id uuid,
  p_description text,
  p_amount_dkk integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  event_guest_event_id uuid;
  event_guest_season_id uuid;
begin
  if not public.is_admin(target_team_id) then
    raise exception 'Admin permission is required';
  end if;

  if p_participant_kind not in ('member', 'guest') then
    raise exception 'Participant is required';
  end if;

  if length(btrim(p_description)) = 0 then
    raise exception 'Description is required';
  end if;

  if p_amount_dkk is null or p_amount_dkk <= 0 then
    raise exception 'Amount must be greater than 0';
  end if;

  if p_participant_kind = 'member' then
    if not exists (
      select 1
      from public.members m
      where m.id = p_participant_id
        and m.team_id = target_team_id
    ) then
      raise exception 'Participant is not eligible';
    end if;

    insert into public.fines (
      team_id,
      member_id,
      description,
      amount_dkk,
      created_by
    )
    values (
      target_team_id,
      p_participant_id,
      regexp_replace(btrim(p_description), '\s+', ' ', 'g'),
      p_amount_dkk,
      auth.uid()
    );
  else
    select guest.event_id, e.season_id
    into event_guest_event_id, event_guest_season_id
    from public.event_guests guest
    join public.events e on e.id = guest.event_id
    where guest.id = p_participant_id
      and e.team_id = target_team_id;

    if event_guest_event_id is null then
      raise exception 'Participant is not eligible';
    end if;

    insert into public.fines (
      team_id,
      season_id,
      event_guest_id,
      event_id,
      description,
      amount_dkk,
      created_by
    )
    values (
      target_team_id,
      event_guest_season_id,
      p_participant_id,
      event_guest_event_id,
      regexp_replace(btrim(p_description), '\s+', ' ', 'g'),
      p_amount_dkk,
      auth.uid()
    );
  end if;

  return public.list_fine_box(target_team_id);
end;
$$;

create or replace function public.update_fine_status(
  target_team_id uuid,
  p_fine_id uuid,
  p_action text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin(target_team_id) then
    raise exception 'Admin permission is required';
  end if;

  if p_action = 'confirm-paid' then
    update public.fines
    set
      payment_status = 'Paid',
      payment_confirmed_by = auth.uid(),
      payment_confirmed_at = now()
    where id = p_fine_id
      and team_id = target_team_id
      and payment_status = 'Payment reported';

    if not found then
      raise exception 'Only reported payments can be confirmed';
    end if;
  elsif p_action = 'waive' then
    update public.fines
    set
      payment_status = 'Waived',
      waived_by = auth.uid(),
      waived_at = now()
    where id = p_fine_id
      and team_id = target_team_id
      and payment_status in ('Unpaid', 'Payment reported');

    if not found then
      raise exception 'Only unpaid or reported fines can be waived';
    end if;
  else
    raise exception 'Unsupported fine action';
  end if;

  return public.list_fine_box(target_team_id);
end;
$$;

grant execute on function public.create_fine(uuid, text, uuid, text, integer) to authenticated;
grant execute on function public.update_fine_status(uuid, uuid, text) to authenticated;
