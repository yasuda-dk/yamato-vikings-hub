create or replace function public.create_fines(
  target_team_id uuid,
  p_participants jsonb,
  p_description text,
  p_amount_dkk integer,
  p_fine_type_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_description text;
  participant record;
  participant_count integer;
  distinct_participant_count integer;
  event_guest_event_id uuid;
  event_guest_season_id uuid;
begin
  if not public.is_admin(target_team_id) then
    raise exception 'Admin permission is required';
  end if;

  if p_participants is null or jsonb_typeof(p_participants) <> 'array' then
    raise exception 'Select at least one participant';
  end if;

  participant_count := jsonb_array_length(p_participants);

  if participant_count = 0 then
    raise exception 'Select at least one participant';
  end if;

  if participant_count > 50 then
    raise exception 'A batch can include at most 50 participants';
  end if;

  select count(distinct concat(participant_kind, ':', participant_id))
  into distinct_participant_count
  from jsonb_to_recordset(p_participants) as selected(participant_kind text, participant_id uuid);

  if distinct_participant_count <> participant_count then
    raise exception 'Each participant can be selected only once';
  end if;

  normalized_description := regexp_replace(btrim(p_description), '\s+', ' ', 'g');

  if length(normalized_description) = 0 then
    raise exception 'Description is required';
  end if;

  if p_amount_dkk is null or p_amount_dkk <= 0 then
    raise exception 'Amount must be greater than 0';
  end if;

  if p_fine_type_id is not null and not exists (
    select 1
    from public.fine_types ft
    where ft.id = p_fine_type_id
      and ft.team_id = target_team_id
      and ft.is_active
  ) then
    raise exception 'Fine type is not active';
  end if;

  for participant in
    select participant_kind, participant_id
    from jsonb_to_recordset(p_participants) as selected(participant_kind text, participant_id uuid)
  loop
    if participant.participant_kind not in ('member', 'guest') then
      raise exception 'Participant is required';
    end if;

    if participant.participant_kind = 'member' then
      if not exists (
        select 1
        from public.members m
        where m.id = participant.participant_id
          and m.team_id = target_team_id
      ) then
        raise exception 'Participant is not eligible';
      end if;

      insert into public.fines (
        team_id,
        member_id,
        fine_type_id,
        description,
        amount_dkk,
        created_by
      )
      values (
        target_team_id,
        participant.participant_id,
        p_fine_type_id,
        normalized_description,
        p_amount_dkk,
        auth.uid()
      );
    else
      select guest.event_id, e.season_id
      into event_guest_event_id, event_guest_season_id
      from public.event_guests guest
      join public.events e on e.id = guest.event_id
      where guest.id = participant.participant_id
        and e.team_id = target_team_id;

      if event_guest_event_id is null then
        raise exception 'Participant is not eligible';
      end if;

      insert into public.fines (
        team_id,
        season_id,
        event_guest_id,
        event_id,
        fine_type_id,
        description,
        amount_dkk,
        created_by
      )
      values (
        target_team_id,
        event_guest_season_id,
        participant.participant_id,
        event_guest_event_id,
        p_fine_type_id,
        normalized_description,
        p_amount_dkk,
        auth.uid()
      );
    end if;
  end loop;

  return public.list_fine_box(target_team_id);
end;
$$;

grant execute on function public.create_fines(uuid, jsonb, text, integer, uuid) to authenticated;
